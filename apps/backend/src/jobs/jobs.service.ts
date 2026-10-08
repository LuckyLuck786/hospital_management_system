import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject('NOTIFICATION_QUEUE') private notificationQueue: Queue,
    @Inject('REMINDER_QUEUE') private reminderQueue: Queue,
    @Inject('EXPIRY_QUEUE') private expiryQueue: Queue,
    @Inject('NOTIFICATION_WORKER') private notificationWorker: Worker,
    @Inject('REMINDER_WORKER') private reminderWorker: Worker,
    @Inject('EXPIRY_WORKER') private expiryWorker: Worker,
  ) {}

  async onModuleInit() {
    // Idempotent: re-adding a scheduler with the same id updates it, never duplicates.
    await this.reminderQueue.upsertJobScheduler(
      'reminder-scan',
      { pattern: '*/15 * * * *' },
      { name: 'reminder-scan', data: {} },
    );
    await this.expiryQueue.upsertJobScheduler(
      'expiry-scan',
      { pattern: '0 1 * * *' }, // 01:00 daily
      { name: 'expiry-scan', data: {} },
    );
    this.logger.log('Scheduled jobs: appointment reminders (*/15) + nightly expiry scan (01:00)');
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.notificationQueue.close(),
      this.reminderQueue.close(),
      this.expiryQueue.close(),
      this.notificationWorker.close(),
      this.reminderWorker.close(),
      this.expiryWorker.close(),
    ]);
  }

  /** Dispatch a stored notification through its channels (email/SMS fan-out). */
  async enqueueNotification(notificationId: string) {
    await this.notificationQueue.add(
      'dispatch',
      { notificationId },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 },
    );
  }
}
