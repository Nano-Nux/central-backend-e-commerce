import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string | null;
  private readonly chatId: string | null;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim() ?? null;
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID')?.trim() ?? null;
  }

  get isEnabled() {
    return Boolean(this.botToken && this.chatId);
  }

  async sendMessage(text: string) {
    if (!this.isEnabled) return;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text,
            parse_mode: 'HTML',
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`Telegram sendMessage failed: ${error}`);
      }
    } catch (error) {
      console.error('Telegram sendMessage error:', error);
    }
  }

  async sendPhoto(photoUrl: string, caption?: string) {
    if (!this.isEnabled) return;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendPhoto`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            photo: photoUrl,
            caption,
            parse_mode: 'HTML',
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`Telegram sendPhoto failed: ${error}`);
      }
    } catch (error) {
      console.error('Telegram sendPhoto error:', error);
    }
  }
}
