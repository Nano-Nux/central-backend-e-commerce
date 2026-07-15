import { DomainEvent } from './domain-event';

export const EVENT_HANDLER_METADATA = Symbol('EVENT_HANDLER_METADATA');

export const EVENT_WILDCARD = '*';

export enum EventProcessingMode {
  SYNC = 'SYNC',
  ASYNC = 'ASYNC',
}

export type EventHandlerOptions = {
  mode?: EventProcessingMode;
  retries?: number;
  priority?: number;
};

export type EventHandlerMetadata = Required<EventHandlerOptions> & {
  eventName: string;
};

export interface EventHandler<TEvent extends DomainEvent = DomainEvent> {
  handle(event: TEvent): void | Promise<void>;
}

export type RegisteredEventHandler = {
  providerName: string;
  methodName: string;
  metadata: EventHandlerMetadata;
  handle: (event: DomainEvent) => void | Promise<void>;
};
