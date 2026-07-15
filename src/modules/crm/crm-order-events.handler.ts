import { Injectable } from '@nestjs/common';

import { SystemEvents } from '../../common/constants/event.constants';
import { DomainEvent } from '../../infrastructure/event-bus/domain-event';
import {
  OrderEventName,
  OrderEventPayload,
} from '../../infrastructure/event-bus/events/order-created.event';
import {
  PaymentRecordedEventPayload,
  PaymentRefundedEventPayload,
} from '../../infrastructure/event-bus/events/payment.events';
import { EventProcessingMode } from '../../infrastructure/event-bus/event-handler.interface';
import { OnEvent } from '../../infrastructure/event-bus/on-event.decorator';
import { CustomerActivitiesService } from '../customer-activities/customer-activities.service';

@Injectable()
export class CrmOrderEventsHandler {
  constructor(
    private readonly customerActivitiesService: CustomerActivitiesService,
  ) {}

  @OnEvent(OrderEventName.Created, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 30,
  })
  recordOrderCreatedTimeline(event: DomainEvent<OrderEventPayload>) {
    if (!event.payload.customerId) {
      return;
    }

    return this.customerActivitiesService.recordActivity({
      customerId: event.payload.customerId,
      eventKey: `order-created:${event.payload.id}:crm-order-created`,
      type: 'ORDER_CREATED',
      description: `Order created: ${event.payload.id}`,
      metadata: {
        eventId: event.eventId,
        orderId: event.payload.id,
        source: event.payload.source,
        total: event.payload.total,
        currency: event.payload.currency,
      },
    });
  }

  @OnEvent(SystemEvents.PAYMENT_SUCCEEDED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 30,
  })
  recordPaymentReceivedTimeline(event: DomainEvent<PaymentRecordedEventPayload>) {
    if (!event.payload.order.customerId) {
      return;
    }

    return this.customerActivitiesService.recordActivity({
      customerId: event.payload.order.customerId,
      eventKey: `payment-succeeded:${event.payload.payment.id}:crm-payment-received`,
      type: 'PAYMENT_RECEIVED',
      description: `Payment received for order ${event.payload.order.id}`,
      metadata: {
        eventId: event.eventId,
        orderId: event.payload.order.id,
        paymentId: event.payload.payment.id,
        amount: event.payload.payment.amount,
        method: event.payload.payment.method,
      },
    });
  }

  @OnEvent(SystemEvents.PAYMENT_REFUNDED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 30,
  })
  recordRefundTimeline(event: DomainEvent<PaymentRefundedEventPayload>) {
    if (!event.payload.order.customerId) {
      return;
    }

    return this.customerActivitiesService.recordActivity({
      customerId: event.payload.order.customerId,
      eventKey: `payment-refunded:${event.payload.refundPayment.id}:crm-payment-refunded`,
      type: 'PAYMENT_REFUNDED',
      description: `Payment refunded for order ${event.payload.order.id}`,
      metadata: {
        eventId: event.eventId,
        orderId: event.payload.order.id,
        originalPaymentId: event.payload.originalPayment.id,
        refundPaymentId: event.payload.refundPayment.id,
        amount: event.payload.originalPayment.amount,
      },
    });
  }
}
