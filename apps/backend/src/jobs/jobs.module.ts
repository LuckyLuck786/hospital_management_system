import { Module } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { REDIS_CLIENT } from '../common/redis.constants';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { JobsService } from './jobs.service';
import { connection, makeExpiryWorker, makeNotificationWorker, makeReminderWorker } from './jobs.processors';

@Module({
  providers: [
    {
      provide: 'NOTIFICATION_QUEUE',
      useFactory: () => new Queue('notifications', { connection }),
    },
    {
      provide: 'REMINDER_QUEUE',
      useFactory: () => new Queue('reminders', { connection }),
    },
    {
      provide: 'EXPIRY_QUEUE',
      useFactory: () => new Queue('expiry-scan', { connection }),
    },
    {
      provide: 'NOTIFICATION_WORKER',
      inject: [PrismaService, EmailService, SmsService],
      useFactory: (prisma: PrismaService, email: EmailService, sms: SmsService) =>
        makeNotificationWorker(prisma, email, sms),
    },
    {
      provide: 'REMINDER_WORKER',
      inject: [PrismaService, REDIS_CLIENT, RealtimeGateway, 'NOTIFICATION_QUEUE'],
      useFactory: (
        prisma: PrismaService,
        redis: InstanceType<typeof import('ioredis').default>,
        realtime: RealtimeGateway,
        notificationQueue: Queue,
      ) => makeReminderWorker(prisma, redis, realtime, notificationQueue),
    },
    {
      provide: 'EXPIRY_WORKER',
      inject: [PrismaService, RealtimeGateway, 'NOTIFICATION_QUEUE'],
      useFactory: (prisma: PrismaService, realtime: RealtimeGateway, notificationQueue: Queue) =>
        makeExpiryWorker(prisma, realtime, notificationQueue),
    },
    JobsService,
  ],
  exports: [JobsService],
})
export class JobsModule {}
