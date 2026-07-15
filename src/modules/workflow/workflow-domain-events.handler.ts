import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { DomainEvent } from '../../infrastructure/event-bus/domain-event';
import {
  EVENT_WILDCARD,
  EventProcessingMode,
} from '../../infrastructure/event-bus/event-handler.interface';
import { OnEvent } from '../../infrastructure/event-bus/on-event.decorator';
import { TriggerService } from '../triggers/trigger.service';

@Injectable()
export class WorkflowDomainEventsHandler {
  constructor(private readonly triggerService: TriggerService) {}

  @OnEvent(EVENT_WILDCARD, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 100,
  })
  evaluateRules(event: DomainEvent) {
    return this.triggerService.dispatchMatchingWorkflows(event.eventName, {
      eventId: event.eventId,
      eventName: event.eventName,
      timestamp: event.timestamp.toISOString(),
      payload: this.toJson(event.payload),
      metadata: this.toJson(event.metadata),
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
