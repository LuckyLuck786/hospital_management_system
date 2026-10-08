import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { JobsService } from '../jobs/jobs.service';
import { NotificationChannel, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private jobs: JobsService,
  ) {}

  async findMine(userId: string, page = 1, limit = 30) {
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications,
      unreadCount,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Create a notification and push it to the user's socket in real time. */
  async createInApp(data: {
    userId: string;
    hospitalId?: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    appointmentId?: string;
  }) {
    return this.create({ ...data, channels: [NotificationChannel.IN_APP] });
  }

  /**
   * Create a multi-channel notification: stored, pushed over Socket.IO, and (for
   * EMAIL/SMS) enqueued to the fan-out worker.
   */
  async create(data: {
    userId: string;
    hospitalId?: string;
    type: NotificationType;
    title: string;
    message: string;
    channels: NotificationChannel[];
    entityType?: string;
    entityId?: string;
    appointmentId?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        hospitalId: data.hospitalId,
        type: data.type,
        title: data.title,
        message: data.message,
        channels: data.channels,
        entityType: data.entityType,
        entityId: data.entityId,
        appointmentId: data.appointmentId,
        inAppSent: true,
      },
    });

    // Real-time push (works for every authenticated, connected user)
    this.realtime.emitToUser(data.userId, 'notification:new', notification);

    // Fan-out to email/SMS handlers in the background
    const needsDispatch = data.channels.some((c) => c !== NotificationChannel.IN_APP);
    if (needsDispatch) {
      await this.jobs.enqueueNotification(notification.id);
    }

    return notification;
  }
}
