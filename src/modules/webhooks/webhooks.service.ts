import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppConfigService } from '../../infrastructure/config/config.service';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AppConfigService,
  ) {}

  async receive(
    provider: string,
    externalId: string,
    payload: Prisma.InputJsonValue,
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
  ) {
    this.verifySignature(provider, rawBody, headers);
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_externalId: { provider, externalId } },
    });
    if (existing) return existing;

    try {
      return await this.prisma.webhookEvent.create({
        data: { provider, externalId, payloadJson: payload, status: 'RECEIVED' },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return this.prisma.webhookEvent.findUniqueOrThrow({
          where: { provider_externalId: { provider, externalId } },
        });
      }
      throw error;
    }
  }

  private verifySignature(
    provider: string,
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
  ) {
    if (!rawBody) {
      throw new UnauthorizedException('Webhook verification is not configured');
    }

    if (provider === 'discord') {
      this.verifyDiscordSignature(rawBody, headers);
      return;
    }

    const secret = this.configService.getWebhookSecret(provider);
    if (!secret) {
      throw new UnauthorizedException('Webhook verification is not configured');
    }

    const signature =
      this.header(headers, this.signatureHeader(provider)) ??
      this.header(headers, 'x-webhook-signature');
    if (!signature) {
      throw new UnauthorizedException('Webhook signature is required');
    }

    if (provider === 'telegram') {
      if (!this.safeEqual(signature, secret)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
      return;
    }

    const provided = signature.replace(/^sha256=/i, '').trim();
    const expectedBase64 = createHmac('sha256', secret).update(rawBody).digest('base64');
    const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!this.safeEqual(provided, expectedBase64) && !this.safeEqual(provided, expectedHex)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private verifyDiscordSignature(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const publicKey = this.configService.getWebhookPublicKey('discord');
    const signature = this.header(headers, 'x-signature-ed25519');
    const timestamp = this.header(headers, 'x-signature-timestamp');

    if (!publicKey || !signature || !timestamp) {
      throw new UnauthorizedException('Discord webhook verification is required');
    }

    const timestampSeconds = Number(timestamp);
    if (!Number.isInteger(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
      throw new UnauthorizedException('Discord webhook timestamp is invalid');
    }

    try {
      const key = createPublicKey({
        key: Buffer.concat([
          Buffer.from('302a300506032b6570032100', 'hex'),
          Buffer.from(publicKey, 'hex'),
        ]),
        format: 'der',
        type: 'spki',
      });
      if (!verify(null, Buffer.concat([Buffer.from(timestamp), rawBody]), key, Buffer.from(signature, 'hex'))) {
        throw new UnauthorizedException('Invalid Discord webhook signature');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid Discord webhook signature');
    }
  }

  private signatureHeader(provider: string) {
    if (provider === 'line') return 'x-line-signature';
    if (provider === 'telegram') return 'x-telegram-bot-api-secret-token';
    if (provider === 'facebook' || provider === 'instagram') return 'x-hub-signature-256';
    return 'x-webhook-signature';
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
