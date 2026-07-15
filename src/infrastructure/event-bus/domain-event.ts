import { randomUUID } from 'node:crypto';

export type DomainEventMetadata = {
  userId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
};

export class DomainEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly timestamp: Date;

  constructor(
    readonly eventName: string,
    readonly payload: TPayload,
    readonly metadata: DomainEventMetadata = {},
    options?: {
      eventId?: string;
      timestamp?: Date;
    },
  ) {
    this.eventId = options?.eventId ?? randomUUID();
    this.timestamp = options?.timestamp ?? new Date();
  }
}
