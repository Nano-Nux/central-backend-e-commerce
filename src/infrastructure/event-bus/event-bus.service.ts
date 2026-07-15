import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

import { DomainEvent, DomainEventMetadata } from './domain-event';
import {
  EVENT_WILDCARD,
  EventProcessingMode,
  RegisteredEventHandler,
} from './event-handler.interface';
import { OutboxRepository } from './outbox.repository';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, RegisteredEventHandler[]>();

  constructor(private readonly outboxRepository: OutboxRepository) {}

  register(handler: RegisteredEventHandler) {
    const handlers = this.handlers.get(handler.metadata.eventName) ?? [];
    handlers.push(handler);
    this.handlers.set(handler.metadata.eventName, handlers);

    this.logger.log(
      `Registered ${handler.metadata.eventName} -> ${handler.providerName}.${handler.methodName} (${handler.metadata.mode}, priority ${handler.metadata.priority})`,
    );
  }

  async emit<TPayload = unknown>(
    eventOrName: DomainEvent<TPayload> | string,
    payload?: TPayload,
    metadata?: DomainEventMetadata,
  ) {
    const event =
      eventOrName instanceof DomainEvent
        ? eventOrName
        : new DomainEvent(eventOrName, payload as TPayload, metadata);

    return this.dispatch(event);
  }

  async publish<TPayload = unknown>(
    event: DomainEvent<TPayload>,
    transaction?: Prisma.TransactionClient,
  ): Promise<void>;
  async publish<TPayload = unknown>(
    eventName: string,
    payload: TPayload,
    metadata?: DomainEventMetadata,
    transaction?: Prisma.TransactionClient,
  ): Promise<void>;
  async publish<TPayload = unknown>(
    eventOrName: DomainEvent<TPayload> | string,
    payloadOrTransaction?: TPayload | Prisma.TransactionClient,
    metadataOrTransaction?: DomainEventMetadata | Prisma.TransactionClient,
    maybeTransaction?: Prisma.TransactionClient,
  ) {
    const event =
      eventOrName instanceof DomainEvent
        ? eventOrName
        : new DomainEvent(
            eventOrName,
            payloadOrTransaction as TPayload,
            (metadataOrTransaction as DomainEventMetadata | undefined) ?? {},
          );
    const transaction =
      payloadOrTransaction &&
      typeof payloadOrTransaction === 'object' &&
      '$queryRaw' in payloadOrTransaction
        ? (payloadOrTransaction as Prisma.TransactionClient)
        : metadataOrTransaction &&
            typeof metadataOrTransaction === 'object' &&
            '$queryRaw' in metadataOrTransaction
          ? (metadataOrTransaction as Prisma.TransactionClient)
          : maybeTransaction;

    await this.outboxRepository.create(
      {
        eventId: event.eventId,
        eventName: event.eventName,
        payloadJson: event.payload as Prisma.InputJsonValue,
        metadataJson: (event.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        occurredAt: event.timestamp,
      },
      transaction,
    );
  }

  async dispatch<TEvent extends DomainEvent>(event: TEvent) {
    const handlers = [
      ...(this.handlers.get(event.eventName) ?? []),
      ...(this.handlers.get(EVENT_WILDCARD) ?? []),
    ].sort((left, right) => left.metadata.priority - right.metadata.priority);

    if (!handlers.length) {
      this.logger.debug(`No handlers registered for ${event.eventName}`);
      return;
    }

    for (const handler of handlers.filter(
      (item) => item.metadata.mode === EventProcessingMode.SYNC,
    )) {
      await this.invoke(handler, event, 0, false);
    }

    for (const handler of handlers.filter(
      (item) => item.metadata.mode === EventProcessingMode.ASYNC,
    )) {
      this.enqueue(handler, event);
    }
  }

  private enqueue(handler: RegisteredEventHandler, event: DomainEvent) {
    setImmediate(() => {
      void this.invoke(handler, event, 0, true);
    });
  }

  private async invoke(
    handler: RegisteredEventHandler,
    event: DomainEvent,
    attempt = 0,
    suppressError = false,
  ) {
    try {
      await handler.handle(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Handler ${handler.providerName}.${handler.methodName} failed for ${event.eventName} (${event.eventId}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (attempt < handler.metadata.retries) {
        if (suppressError) {
          setImmediate(() => {
            void this.invoke(handler, event, attempt + 1, true);
          });
          return;
        }

        await this.invoke(handler, event, attempt + 1, false);
        return;
      }

      if (!suppressError) {
        throw error;
      }
    }
  }

  async processOutboxBatch(limit: number) {
    const events = await this.outboxRepository.claimPendingBatch(limit);

    for (const event of events) {
      try {
        await this.dispatch(
          new DomainEvent(
            event.eventName,
            event.payloadJson,
            this.toMetadata(event.metadataJson),
            {
              eventId: event.eventId,
              timestamp: event.occurredAt,
            },
          ),
        );
        await this.outboxRepository.markProcessed(event.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        this.logger.error(
          `Outbox dispatch failed for ${event.eventName} (${event.eventId}): ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
        await this.outboxRepository.markFailed(event.id, message);
      }
    }

    return events.length;
  }

  private toMetadata(value: Prisma.JsonValue | null | undefined): DomainEventMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const metadata = value as Record<string, unknown>;

    return {
      userId: typeof metadata.userId === 'string' ? metadata.userId : undefined,
      requestId:
        typeof metadata.requestId === 'string' ? metadata.requestId : undefined,
      correlationId:
        typeof metadata.correlationId === 'string'
          ? metadata.correlationId
          : undefined,
      source: typeof metadata.source === 'string' ? metadata.source : undefined,
    };
  }
}
