import {
  EVENT_HANDLER_METADATA,
  EventHandlerMetadata,
  EventHandlerOptions,
  EventProcessingMode,
} from './event-handler.interface';

export function OnEvent(eventName: string, options: EventHandlerOptions = {}) {
  const metadata: EventHandlerMetadata = {
    eventName,
    mode: options.mode ?? EventProcessingMode.SYNC,
    retries: options.retries ?? 0,
    priority: options.priority ?? 0,
  };

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(EVENT_HANDLER_METADATA, metadata, descriptor.value);
  };
}
