import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

export interface ChannelResult {
  delivered: boolean;
  reason?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly smtp: nodemailer.Transporter | null;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    // Treat template placeholders (containing 'xxx') as not configured.
    const placeholder = (v?: string) => !v || /xxx|your_|example/i.test(v);
    this.client = !placeholder(key) ? new Resend(key!) : null;
    // SMTP (e.g. Gmail app password) is used when no Resend key is configured.
    const smtpUrl = process.env.SMTP_URL;
    this.smtp = !this.client && !placeholder(smtpUrl) ? nodemailer.createTransport(smtpUrl!) : null;
    if (!this.client && !this.smtp) {
      this.logger.warn(
        'Neither RESEND_API_KEY nor SMTP_URL is set (or still a placeholder) — emails will be logged instead of delivered. ' +
          'Add one to apps/backend/.env to enable sending.',
      );
    }
  }

  get configured(): boolean {
    return !!this.client || !!this.smtp;
  }

  async send(to: string, subject: string, html: string): Promise<ChannelResult> {
    if (!this.client && !this.smtp) {
      this.logger.warn(`[email (dry-run)] to=${to} subject="${subject}"`);
      return { delivered: false, reason: 'RESEND_API_KEY / SMTP_URL not configured' };
    }
    try {
      if (this.client) {
        const from = process.env.EMAIL_FROM || 'MedCore HMS <onboarding@resend.dev>';
        await this.client.emails.send({ from, to, subject, html });
      } else {
        const name = process.env.EMAIL_FROM_NAME || 'MedCore HMS';
        const addr = process.env.EMAIL_FROM || '';
        const from = addr.includes('<') || !addr ? addr || undefined : `${name} <${addr}>`;
        await this.smtp!.sendMail({ from, to, subject, html });
      }
      return { delivered: true };
    } catch (err) {
      this.logger.error(`Email send failed: ${(err as Error).message}`);
      return { delivered: false, reason: (err as Error).message };
    }
  }
}
