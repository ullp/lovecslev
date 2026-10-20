import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  readonly title: string;
  readonly body: string;
}

/** Port pro notifikace (spec §6 P2): push primárně, e-mail jako fallback. */
export interface NotificationSender {
  sendPush(tokens: readonly string[], message: PushMessage): Promise<boolean>;
  sendEmail(to: string, subject: string, text: string): Promise<boolean>;
  /** Je e-mailový fallback vůbec nakonfigurovaný? (bez klíče se nemá počítat jako failure) */
  isEmailConfigured(): boolean;
}

export const NOTIFICATION_SENDER = Symbol('NOTIFICATION_SENDER');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const RESEND_URL = 'https://api.resend.com/emails';

/** Expo Push (spec P2) — timeout 10 s dle §15.2; selhání nesmí shodit evaluaci. */
@Injectable()
export class ExpoPushSender implements NotificationSender {
  private readonly logger = new Logger(ExpoPushSender.name);

  constructor(
    private readonly endpoint: string = EXPO_PUSH_URL,
    private readonly timeoutMs = 10_000,
  ) {}

  async sendPush(tokens: readonly string[], message: PushMessage): Promise<boolean> {
    if (tokens.length === 0) return false;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          tokens.map((to) => ({ to, title: message.title, body: message.body, sound: 'default' })),
        ),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return response.ok;
    } catch (error) {
      this.logger.warn(`Expo push selhal: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /** E-mail fallback přes Resend (D20) — bez API klíče se jen zaloguje. */
  isEmailConfigured(): boolean {
    return (process.env.RESEND_API_KEY ?? '') !== '';
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM ?? 'Slevaři kolem mě <no-reply@slevarikoleme.cz>';

    if (apiKey === undefined || apiKey === '') {
      this.logger.log(`[email fallback] ${to}: ${subject} — ${text}`);
      return false;
    }

    try {
      const response = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return response.ok;
    } catch (error) {
      this.logger.warn(`Resend selhal: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
