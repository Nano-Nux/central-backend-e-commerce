import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { EventDispatcher } from './event-dispatcher.service';
import { EventBusService } from './event-bus.service';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxRepository } from './outbox.repository';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    EventBusService,
    EventDispatcher,
    OutboxRepository,
    OutboxProcessorService,
  ],
  exports: [EventBusService],
})
export class EventBusModule {}
