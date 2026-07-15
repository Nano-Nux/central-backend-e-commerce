import { Injectable } from '@nestjs/common';

import { SystemEvents } from '../../common/constants/event.constants';
import { DomainEvent } from '../../infrastructure/event-bus/domain-event';
import { EventProcessingMode } from '../../infrastructure/event-bus/event-handler.interface';
import { OnEvent } from '../../infrastructure/event-bus/on-event.decorator';
import {
  PaymentRecordedEventPayload,
  PaymentRefundedEventPayload,
} from '../../infrastructure/event-bus/events/payment.events';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersPaymentEventsHandler {
  constructor(private readonly ordersService: OrdersService) {}

  @OnEvent(SystemEvents.PAYMENT_SUCCEEDED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  async markOrderPaid(event: DomainEvent<PaymentRecordedEventPayload>) {
    if (!event.payload.orderFullyPaid) {
      return;
    }

    await this.ordersService.markPaid(event.payload.order.id, {
      actorId: event.metadata?.userId,
    });
  }

  @OnEvent(SystemEvents.PAYMENT_FAILED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  async cancelOrderOnPaymentFailure(
    event: DomainEvent<PaymentRecordedEventPayload>,
  ) {
    await this.ordersService.cancel(event.payload.order.id, {
      actorId: event.metadata?.userId,
    });
  }

  @OnEvent(SystemEvents.PAYMENT_REFUNDED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  async markOrderRefunded(event: DomainEvent<PaymentRefundedEventPayload>) {
    await this.ordersService.markRefunded(event.payload.order.id, {
      actorId: event.metadata?.userId,
    });
  }
}
