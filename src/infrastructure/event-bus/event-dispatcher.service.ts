import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';

import { EventBusService } from './event-bus.service';
import {
  EVENT_HANDLER_METADATA,
  EventHandlerMetadata,
} from './event-handler.interface';

@Injectable()
export class EventDispatcher implements OnModuleInit {
  private readonly logger = new Logger(EventDispatcher.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit() {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;

      if (!instance || !wrapper.metatype) {
        continue;
      }

      const prototype = Object.getPrototypeOf(instance);
      const methodNames = this.metadataScanner.getAllMethodNames(prototype);

      for (const methodName of methodNames) {
        const method = instance[methodName];

        if (typeof method !== 'function') {
          continue;
        }

        const metadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, method) as
          | EventHandlerMetadata
          | undefined;

        if (!metadata) {
          continue;
        }

        this.eventBus.register({
          providerName: wrapper.metatype.name,
          methodName,
          metadata,
          handle: method.bind(instance),
        });
      }
    }

    this.logger.log('Domain event handlers registered');
  }
}
