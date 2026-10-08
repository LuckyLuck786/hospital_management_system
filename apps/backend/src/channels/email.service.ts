import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface ChannelResult {
  delivered: boolean;
  reason?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    // Treat template placeholders (containing 'xxx') as not configured.
    const placeholder = (v?: string) => !v || /xxx|your_|example/i.test(v);
    this.client = !placeholder(key) ? new Resend(key!) : null;
    if (!this.client) {
      this.logger.warn(
        'RESEND_API_KEY is not set (or still a placeholder) — emails will be logged instead of delivered. ' +
          'Add the key to apps/backend/.env to enable sending.',
      );
    }
  }

  get configured(): boolean {
    return !!this.client;
  }

  async send(to: string, subject: string, html: string): Promise<ChannelResult> {
    if (!this.client) {
      this.logger.warn(`[email (dry-run)] to=${to} subject="${subject}"`);
      return { delivered: false, reason: 'RESEND_API_KEY not configured' };
    }
    try {
      const from = process.env.EMAIL_FROM || 'MedCore HMS <onboarding@resend.dev>';
      await this.client.emails.send({ from, to, subject, html });
      return { delivered: true };
    } catch (err) {
      this.logger.error(`Resend send failed: ${(err as Error).message}`);
      return { delivered: false, reason: (err as Error).message };
    }
  }
}
