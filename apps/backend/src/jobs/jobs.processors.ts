import { Logger } from '@nestjs/common';
import { Worker, Job, Queue, ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationChannel, NotificationType, UserRole } from '@prisma/client';

const log = new Logger('Jobs');

export const connection: ConnectionOptions = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

/** Enqueue a stored notification for email/SMS fan-out (shared with JobsService). */
export async function dispatchNotification(queue: Queue, notificationId: string) {
  await queue.add(
    'dispatch',
    { notificationId },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 },
  );
}

function simpleEmailHtml(title: string, message: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
    <h2 style="color:#4f46e5;margin:0 0 8px">MedCore HMS</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Hospital Management Platform</p>
    <h3 style="color:#111827">${title}</h3>
    <p style="color:#374151;line-height:1.6">${message}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="color:#9ca3af;font-size:12px">This is an automated notification from MedCore HMS. Please do not reply.</p>
  </div>`;
}

/** Fan-out: take a stored notification and dispatch EMAIL/SMS via the providers. */
export function makeNotificationWorker(
  prisma: PrismaService,
  email: EmailService,
  sms: SmsService,
): Worker {
  const worker = new Worker(
    'notifications',
    async (job: Job<{ notificationId: string }>) => {
      const n = await prisma.notification.findUnique({
        where: { id: job.data.notificationId },
        include: { user: { select: { email: true, phone: true, firstName: true, lastName: true } } },
      });
      if (!n) return;

      const channels = n.channels as NotificationChannel[];

      if (channels.includes(NotificationChannel.EMAIL) && n.user.email) {
        const res = await email.send(
          n.user.email,
          n.title,
          simpleEmailHtml(n.title, n.message),
        );
        if (res.delivered) {
          await prisma.notification.update({
            where: { id: n.id },
            data: { emailSent: true, emailSentAt: new Date() },
          });
        } else {
          log.warn(`Email undelivered for notification ${n.id}: ${res.reason}`);
        }
      }

      if (channels.includes(NotificationChannel.SMS) && n.user.phone) {
        const res = await sms.send(n.user.phone, n.message);
        if (res.delivered) {
          await prisma.notification.update({
            where: { id: n.id },
            data: { smsSent: true, smsSentAt: new Date() },
          });
        } else {
          log.warn(`SMS undelivered for notification ${n.id}: ${res.reason}`);
        }
      }
    },
    { connection, concurrency: 5 },
  );
  worker.on('failed', (job, err) => log.error(`Notification job ${job?.id} failed: ${err.message}`));
  return worker;
}

/** Scan for appointments starting in ~24h and ~1h, then notify the patient once per window. */
export function makeReminderWorker(
  prisma: PrismaService,
  redis: Redis,
  realtime: RealtimeGateway,
  notificationQueue: Queue,
): Worker {
  const worker = new Worker(
    'reminders',
    async () => {
      const now = Date.now();
      const appointments = await prisma.appointment.findMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          deletedAt: null,
          scheduledDate: { gte: new Date(now - 24 * 3600 * 1000) },
        },
        select: {
          id: true,
          scheduledDate: true,
          scheduledTime: true,
          hospitalId: true,
          patient: {
            select: {
              userId: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          doctor: { select: { user: { select: { lastName: true } } } },
        },
      });

      let reminded = 0;
      for (const a of appointments) {
        const start = new Date(`${a.scheduledDate.toISOString().slice(0, 10)}T${a.scheduledTime}`).getTime();
        if (start <= now) continue;
        const diffHours = (start - now) / 3600 / 1000;
        const window = diffHours <= 1.5 ? '1h' : diffHours <= 25 ? '24h' : null;
        if (!window) continue;

        // Dedup per appointment + window (7-day TTL)
        const key = `reminded:${a.id}:${window}`;
        const acquired = await redis.set(key, '1', 'EX', 7 * 24 * 3600, 'NX');
        if (!acquired) continue;

        const hoursLabel = window === '24h' ? '24 hours' : '1 hour';
        const notification = await prisma.notification.create({
          data: {
            userId: a.patient.userId,
            hospitalId: a.hospitalId,
            type: NotificationType.APPOINTMENT_REMINDER,
            title: `Appointment reminder — ${hoursLabel} to go`,
            message: `Hi ${a.patient.user.firstName}, your appointment with Dr. ${a.doctor.user.lastName} is in ${hoursLabel} (${a.scheduledTime}). See you soon!`,
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
            entityType: 'Appointment',
            entityId: a.id,
            appointmentId: a.id,
            inAppSent: true,
          },
        });
        realtime.emitToUser(a.patient.userId, 'notification:new', notification);
        await dispatchNotification(notificationQueue, notification.id);
        reminded += 1;
      }
      if (reminded) log.log(`Sent ${reminded} appointment reminder(s)`);
    },
    { connection, concurrency: 1 },
  );
  worker.on('failed', (job, err) => log.error(`Reminder scan failed: ${err.message}`));
  return worker;
}

/** Nightly scan: medicines with batches expiring within 30 days → alert staff. */
export function makeExpiryWorker(
  prisma: PrismaService,
  realtime: RealtimeGateway,
  notificationQueue: Queue,
): Worker {
  const worker = new Worker(
    'expiry-scan',
    async () => {
      const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const batches = await prisma.medicineBatch.findMany({
        where: {
          isExpired: false,
          isQuarantined: false,
          quantity: { gt: 0 },
          expiryDate: { lte: in30 },
        },
        include: { medicine: { select: { id: true, name: true, hospitalId: true } } },
      });
      if (!batches.length) return;

      const byHospital = new Map<string, typeof batches>();
      for (const b of batches) {
        const list = byHospital.get(b.medicine.hospitalId) || [];
        list.push(b);
        byHospital.set(b.medicine.hospitalId, list);
      }

      let alerts = 0;
      for (const [hospitalId, list] of byHospital) {
        const staff = await prisma.user.findMany({
          where: {
            hospitalId,
            isActive: true,
            role: { in: [UserRole.HOSPITAL_ADMIN, UserRole.PHARMACIST] },
          },
          select: { id: true },
        });
        const names = list
          .slice(0, 6)
          .map((b) => `${b.medicine.name} (batch ${b.batchNumber}, ${b.expiryDate.toISOString().slice(0, 10)})`)
          .join(', ');
        const more = list.length > 6 ? ` +${list.length - 6} more` : '';
        for (const s of staff) {
          const notification = await prisma.notification.create({
            data: {
              userId: s.id,
              hospitalId,
              type: NotificationType.MEDICINE_EXPIRY_ALERT,
              title: `${list.length} medicine batch(es) expire within 30 days`,
              message: `Expiring soon: ${names}${more}. Review stock and plan rotation.`,
              channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
              inAppSent: true,
            },
          });
          realtime.emitToUser(s.id, 'notification:new', notification);
          await dispatchNotification(notificationQueue, notification.id);
          alerts += 1;
        }
      }
      if (alerts) log.log(`Expiry scan raised ${alerts} alert(s)`);
    },
    { connection, concurrency: 1 },
  );
  worker.on('failed', (job, err) => log.error(`Expiry scan failed: ${err.message}`));
  return worker;
}
