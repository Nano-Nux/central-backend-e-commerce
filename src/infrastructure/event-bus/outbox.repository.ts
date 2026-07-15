import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { OutboxEventStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

type TransactionClient = Prisma.TransactionClient;
const MAX_EVENT_ATTEMPTS = 10;

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.OutboxEventUncheckedCreateInput,
    transaction?: TransactionClient,
  ) {
    return (transaction ?? this.prisma).outboxEvent.create({ data });
  }

  async claimPendingBatch(limit: number) {
    const lockedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const events = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM outbox_events
        WHERE status = ${OutboxEventStatus.PENDING}
          AND available_at <= CURRENT_TIMESTAMP(3)
        ORDER BY created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      if (!events.length) {
        return [];
      }

      await transaction.outboxEvent.updateMany({
        where: {
          id: {
            in: events.map((event) => event.id),
          },
          status: OutboxEventStatus.PENDING,
        },
        data: {
          status: OutboxEventStatus.PROCESSING,
          lockedAt,
          attempts: {
            increment: 1,
          },
        },
      });

      return transaction.outboxEvent.findMany({
        where: {
          id: {
            in: events.map((event) => event.id),
          },
          status: OutboxEventStatus.PROCESSING,
          lockedAt,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });
  }

  releaseStuckProcessing(before: Date) {
    return this.prisma.outboxEvent.updateMany({
      where: {
        status: OutboxEventStatus.PROCESSING,
        lockedAt: {
          lt: before,
        },
      },
      data: {
        status: OutboxEventStatus.PENDING,
        lockedAt: null,
        availableAt: new Date(),
      },
    });
  }

  markProcessed(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.PROCESSED,
        processedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
  }

  markFailed(id: string, message: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.FAILED,
        lockedAt: null,
        availableAt: new Date(),
        lastError: message.slice(0, 1000),
      },
    });
  }

  retryFailed(limit: number) {
    return this.prisma.$transaction(async (transaction) => {
      const failedEvents = await transaction.outboxEvent.findMany({
        where: {
          status: OutboxEventStatus.FAILED,
          attempts: { lt: MAX_EVENT_ATTEMPTS },
        },
        orderBy: {
          updatedAt: 'asc',
        },
        take: limit,
        select: {
          id: true,
        },
      });

      if (!failedEvents.length) {
        return { count: 0 };
      }

      return transaction.outboxEvent.updateMany({
        where: {
          id: {
            in: failedEvents.map((event) => event.id),
          },
          status: OutboxEventStatus.FAILED,
        },
        data: {
          status: OutboxEventStatus.PENDING,
          availableAt: new Date(),
        },
      });
    });
  }
}
