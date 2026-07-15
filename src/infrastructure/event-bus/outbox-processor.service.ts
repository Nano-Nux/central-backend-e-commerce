import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { EventBusService } from './event-bus.service';
import { OutboxRepository } from './outbox.repository';

@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private readonly intervalMs = 5000;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly eventBus: EventBusService,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  onModuleInit() {
    void this.runCycle();
    this.timer = setInterval(() => {
      void this.runCycle();
    }, this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async runCycle() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.outboxRepository.releaseStuckProcessing(
        new Date(Date.now() - this.intervalMs * 12),
      );
      await this.outboxRepository.retryFailed(100);
      const processed = await this.eventBus.processOutboxBatch(100);

      if (processed > 0) {
        this.logger.debug(`Processed ${processed} outbox events`);
      }
    } finally {
      this.running = false;
    }
  }
}
