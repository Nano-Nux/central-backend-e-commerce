import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

jest.mock('../../infrastructure/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  const payload = { event: 'message', id: 'evt-1' };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const secret = 'webhook-secret';
  const signature = createHmac('sha256', secret).update(rawBody).digest('base64');

  function createService(existing: unknown = null) {
    const prisma = {
      webhookEvent: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockResolvedValue({ id: 'stored' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'stored' }),
      },
    } as never;
    const config = {
      getWebhookSecret: jest.fn().mockReturnValue(secret),
    } as never;
    return {
      service: new WebhooksService(prisma, config),
      prisma,
    };
  }

  it('rejects unsigned webhooks', async () => {
    const { service } = createService();

    await expect(
      service.receive('line', 'evt-1', payload, rawBody, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid HMAC signature', async () => {
    const { service, prisma } = createService();

    await service.receive(
      'line',
      'evt-1',
      payload,
      rawBody,
      { 'x-line-signature': signature },
    );

    expect(prisma.webhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid HMAC signature', async () => {
    const { service } = createService();

    await expect(
      service.receive(
        'line',
        'evt-1',
        payload,
        rawBody,
        { 'x-line-signature': 'invalid' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the existing event for replayed delivery', async () => {
    const existing = { id: 'existing' };
    const { service, prisma } = createService(existing);

    const result = await service.receive(
      'line',
      'evt-1',
      payload,
      rawBody,
      { 'x-line-signature': signature },
    );

    expect(result).toBe(existing);
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
  });
});
