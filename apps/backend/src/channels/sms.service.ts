import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';
import type { ChannelResult } from './email.service';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: ReturnType<typeof twilio> | null;

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    // Treat template placeholders (containing 'xxx') as not configured.
    const placeholder = (v?: string) => !v || /xxx|your_|example/i.test(v);
    this.client = !placeholder(sid) && !placeholder(token) ? twilio(sid!, token!) : null;
    if (!this.client) {
      this.logger.warn(
        'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set (or still placeholders) — SMS will be logged instead of sent.',
      );
    }
  }

  get configured(): boolean {
    return !!this.client && !!process.env.TWILIO_PHONE_NUMBER;
  }

  async send(to: string, body: string): Promise<ChannelResult> {
    if (!this.client) {
      this.logger.warn(`[sms (dry-run)] to=${to} "${body.slice(0, 80)}"`);
      return { delivered: false, reason: 'Twilio not configured' };
    }
    if (!process.env.TWILIO_PHONE_NUMBER) {
      this.logger.warn(`[sms (dry-run)] TWILIO_PHONE_NUMBER missing; to=${to} "${body.slice(0, 80)}"`);
      return { delivered: false, reason: 'TWILIO_PHONE_NUMBER not configured' };
    }
    try {
      await this.client.messages.create({
        to,
        from: process.env.TWILIO_PHONE_NUMBER,
        body,
      });
      return { delivered: true };
    } catch (err) {
      this.logger.error(`Twilio send failed: ${(err as Error).message}`);
      return { delivered: false, reason: (err as Error).message };
    }
  }

  /** Twilio Verify sends its own OTP template, which works even on restricted trial accounts. */
  get verifyEnabled(): boolean {
    return !!this.client && !!process.env.TWILIO_VERIFY_SERVICE_SID;
  }

  async startVerification(to: string): Promise<ChannelResult> {
    if (!this.verifyEnabled) return { delivered: false, reason: 'Twilio Verify not configured' };
    try {
      await this.client!.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!).verifications.create({ to, channel: 'sms' });
      return { delivered: true };
    } catch (err) {
      this.logger.error(`Twilio Verify send failed: ${(err as Error).message}`);
      return { delivered: false, reason: (err as Error).message };
    }
  }

  async checkVerification(to: string, code: string): Promise<boolean> {
    if (!this.verifyEnabled) return false;
    try {
      const res = await this.client!.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!).verificationChecks.create({ to, code });
      return res.status === 'approved';
    } catch (err) {
      this.logger.warn(`Twilio Verify check failed: ${(err as Error).message}`);
      return false;
    }
  }
}
