import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HandoffService {
  private readonly logger = new Logger(HandoffService.name);

  async request(phone: string | undefined, summary: string): Promise<void> {
    // W logach tylko zamaskowany numer (RODO)
    this.logger.log(`Handoff requested, phone=${maskPhone(phone)}`);

    const url = process.env.HANDOFF_WEBHOOK_URL;
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, summary }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      this.logger.error('Handoff webhook failed');
    }
  }
}

export function maskPhone(phone?: string): string {
  return phone ? `***${phone.slice(-3)}` : 'unknown';
}
