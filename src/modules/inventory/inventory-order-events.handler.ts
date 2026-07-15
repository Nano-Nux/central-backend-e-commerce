import { Injectable } from '@nestjs/common';

import { InventoryReferenceType } from '../../../generated/prisma/enums';
import { SystemEvents } from '../../common/constants/event.constants';
import { DomainEvent } from '../../infrastructure/event-bus/domain-event';
import {
  OrderEventName,
  OrderEventPayload,
} from '../../infrastructure/event-bus/events/order-created.event';
import { PaymentRefundedEventPayload } from '../../infrastructure/event-bus/events/payment.events';
import { EventProcessingMode } from '../../infrastructure/event-bus/event-handler.interface';
import { OnEvent } from '../../infrastructure/event-bus/on-event.decorator';
import { InventoryService } from './inventory.service';

@Injectable()
export class InventoryOrderEventsHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  @OnEvent(OrderEventName.Created, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 10,
  })
  async reserveStock(event: DomainEvent<OrderEventPayload>) {
    for (const item of event.payload.items) {
      if (!item.isStockTracked) {
        continue;
      }

      await this.inventoryService.reserveStock({
        productId: item.productId,
        variantId: item.variantId,
        stockItemId: item.stockItemId,
        unitId: item.unitId,
        assetIds: item.assetIds,
        quantity: item.quantity,
        referenceId: event.payload.id,
        reservationKey: `order-created:${event.payload.id}:${item.id}:reserve`,
        metadata: {
          eventId: event.eventId,
          eventName: event.eventName,
          orderItemId: item.id,
        },
      });
    }
  }

  @OnEvent(OrderEventName.Paid, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 10,
  })
  async deductStock(event: DomainEvent<OrderEventPayload>) {
    for (const item of event.payload.items) {
      if (!item.isStockTracked) {
        continue;
      }

      await this.inventoryService.stockOutAndReleaseReservation(
        {
          productId: item.productId,
          variantId: item.variantId,
          stockItemId: item.stockItemId,
          unitId: item.unitId,
          assetIds: item.assetIds,
          quantity: item.quantity,
          eventKey: `order-paid:${event.payload.id}:${item.id}:stock-out`,
          referenceType: InventoryReferenceType.ORDER,
          referenceId: event.payload.id,
          serialNumbers: item.serialNumbers,
          metadata: {
            eventId: event.eventId,
            eventName: event.eventName,
            orderItemId: item.id,
            source: event.payload.source,
          },
        },
        {
          productId: item.productId,
          variantId: item.variantId,
          stockItemId: item.stockItemId,
          unitId: item.unitId,
          assetIds: item.assetIds,
          quantity: item.quantity,
          referenceId: event.payload.id,
          reservationKey: `order-created:${event.payload.id}:${item.id}:reserve`,
          metadata: {
            eventId: event.eventId,
            eventName: event.eventName,
            orderItemId: item.id,
          },
        },
      );
    }
  }

  @OnEvent(OrderEventName.Cancelled, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 10,
  })
  async releaseStock(event: DomainEvent<OrderEventPayload>) {
    for (const item of event.payload.items) {
      if (!item.isStockTracked) {
        continue;
      }

      await this.inventoryService.releaseReservedStock({
        productId: item.productId,
        variantId: item.variantId,
        stockItemId: item.stockItemId,
        unitId: item.unitId,
        quantity: item.quantity,
        referenceId: event.payload.id,
        reservationKey: `order-created:${event.payload.id}:${item.id}:reserve`,
        metadata: {
          eventId: event.eventId,
          eventName: event.eventName,
          orderItemId: item.id,
        },
      });
    }
  }

  @OnEvent(SystemEvents.PAYMENT_REFUNDED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 10,
  })
  async restoreStockOnRefund(event: DomainEvent<PaymentRefundedEventPayload>) {
    for (const item of event.payload.order.items) {
      if (!item.isStockTracked) {
        continue;
      }

      await this.inventoryService.restockOrderItemFromRefund(
        {
          productId: item.productId,
          variantId: item.variantId,
          stockItemId: item.stockItemId,
          unitId: item.unitId,
          baseQuantity: item.baseQuantity,
          quantity: item.quantity,
          orderId: event.payload.order.id,
          assetIds: item.assetIds,
          serialNumbers: item.serialNumbers,
          eventKey: `payment-refunded:${event.payload.refundPayment.id}:${item.id}:restock`,
        },
        {
          actorId: event.metadata?.userId,
        },
      );
    }
  }
}
