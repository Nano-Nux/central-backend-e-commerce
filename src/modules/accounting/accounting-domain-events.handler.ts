import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
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
import {
  PurchaseEventName,
  PurchaseReceivedPayload,
} from '../../infrastructure/event-bus/events/purchase-received.event';
import { EventProcessingMode } from '../../infrastructure/event-bus/event-handler.interface';
import { OnEvent } from '../../infrastructure/event-bus/on-event.decorator';
import { AccountingService } from './accounting.service';

type InventoryStockOutPayload = {
  referenceId: string;
  referenceType: string;
  movementId: string;
  allocations?: Array<{
    quantity: string;
    unitCost: string;
  }>;
};

type InventoryStockInPayload = {
  referenceId: string;
  referenceType: string;
  movementId: string;
  quantity?: string;
  unitCost?: string;
};

type InventoryAdjustedPayload = {
  referenceId: string;
  movementId: string;
  quantity: string;
  unitCost?: string | null;
  allocations?: Array<{
    quantity: string;
    unitCost: string;
  }>;
};

@Injectable()
export class AccountingDomainEventsHandler {
  constructor(private readonly accountingService: AccountingService) {}

  @OnEvent(OrderEventName.Paid, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  recordOrderSale(event: DomainEvent<OrderEventPayload>) {
    return this.accountingService.recordOrderSale({
      orderId: event.payload.id,
      amount: event.payload.total,
      eventKey: `order-paid:${event.payload.id}:sale`,
    });
  }

  @OnEvent(SystemEvents.PAYMENT_SUCCEEDED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  recordPaymentReceived(event: DomainEvent<PaymentRecordedEventPayload>) {
    return this.accountingService.recordPaymentReceived({
      paymentId: event.payload.payment.id,
      orderId: event.payload.order.id,
      method: event.payload.payment.method,
      amount: event.payload.payment.amount,
      eventKey: `payment-succeeded:${event.payload.payment.id}:cash`,
    });
  }

  @OnEvent(SystemEvents.PAYMENT_REFUNDED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  async recordPaymentRefund(event: DomainEvent<PaymentRefundedEventPayload>) {
    const amount = new Prisma.Decimal(event.payload.originalPayment.amount).abs();

    await this.accountingService.reversePaymentReceived({
      paymentId: event.payload.refundPayment.id,
      orderId: event.payload.order.id,
      method: event.payload.refundPayment.method,
      amount,
      eventKey: `payment-refunded:${event.payload.refundPayment.id}:cash-reversal`,
    });

    await this.accountingService.reverseOrderSale({
      orderId: event.payload.order.id,
      amount,
      eventKey: `payment-refunded:${event.payload.refundPayment.id}:sale-reversal`,
    });
  }

  @OnEvent(SystemEvents.INVENTORY_STOCK_OUT, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  recordInventoryCogs(event: DomainEvent<InventoryStockOutPayload>) {
    if (
      event.payload.referenceType !== 'ORDER' &&
      event.payload.referenceType !== 'ADJUSTMENT'
    ) {
      return;
    }

    const amount = (event.payload.allocations ?? []).reduce(
      (total, allocation) =>
        total.plus(
          new Prisma.Decimal(allocation.quantity).mul(allocation.unitCost),
        ),
      new Prisma.Decimal(0),
    );

    if (event.payload.referenceType === 'ORDER') {
      return this.accountingService.recordInventoryCogs({
        orderId: event.payload.referenceId,
        amount,
        eventKey: `inventory-stock-out:${event.payload.movementId}:cogs`,
        description: `COGS for order ${event.payload.referenceId}`,
      });
    }

    return this.accountingService.recordInventoryAdjustmentDecrease({
      referenceId: event.payload.referenceId,
      amount,
      eventKey: `inventory-stock-out:${event.payload.movementId}:adjustment`,
      description: `Inventory decrease adjustment ${event.payload.referenceId}`,
    });
  }

  @OnEvent(SystemEvents.INVENTORY_STOCK_IN, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  recordInventoryReturn(event: DomainEvent<InventoryStockInPayload>) {
    if (
      event.payload.referenceType !== 'RETURN' &&
      event.payload.referenceType !== 'ADJUSTMENT'
    ) {
      return;
    }

    const quantity = new Prisma.Decimal(event.payload.quantity ?? 0);
    const unitCost = new Prisma.Decimal(event.payload.unitCost ?? 0);
    const amount = quantity.mul(unitCost);

    if (event.payload.referenceType === 'RETURN') {
      return this.accountingService.reverseInventoryCogs({
        orderId: event.payload.referenceId,
        amount,
        eventKey: `inventory-stock-in:${event.payload.movementId}:cogs-reversal`,
        description: `Inventory return for refunded order ${event.payload.referenceId}`,
      });
    }

    return this.accountingService.recordInventoryAdjustmentIncrease({
      referenceId: event.payload.referenceId,
      amount,
      eventKey: `inventory-stock-in:${event.payload.movementId}:adjustment`,
      description: `Inventory increase adjustment ${event.payload.referenceId}`,
    });
  }

  @OnEvent(SystemEvents.INVENTORY_ADJUSTED, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  recordInventoryAdjustment(event: DomainEvent<InventoryAdjustedPayload>) {
    const quantity = new Prisma.Decimal(event.payload.quantity);
    const amount = (event.payload.allocations ?? []).reduce(
      (total, allocation) =>
        total.plus(
          new Prisma.Decimal(allocation.quantity).mul(allocation.unitCost),
        ),
      new Prisma.Decimal(0),
    );
    const fallbackAmount = quantity
      .abs()
      .mul(new Prisma.Decimal(event.payload.unitCost ?? 0));
    const resolvedAmount = amount.gt(0) ? amount : fallbackAmount;

    if (quantity.lt(0)) {
      return this.accountingService.recordInventoryAdjustmentDecrease({
        referenceId: event.payload.referenceId,
        amount: resolvedAmount,
        eventKey: `inventory-adjusted:${event.payload.movementId}:decrease`,
        description: `Inventory decrease adjustment ${event.payload.referenceId}`,
      });
    }

    return this.accountingService.recordInventoryAdjustmentIncrease({
      referenceId: event.payload.referenceId,
      amount: resolvedAmount,
      eventKey: `inventory-adjusted:${event.payload.movementId}:increase`,
      description: `Inventory increase adjustment ${event.payload.referenceId}`,
    });
  }

  @OnEvent(PurchaseEventName.Received, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 20,
  })
  recordPurchaseReceived(event: DomainEvent<PurchaseReceivedPayload>) {
    return this.accountingService.recordGoodsReceived({
      goodsReceiptId: event.payload.goodsReceiptId,
      amount: event.payload.total,
      eventKey: `purchase-received:${event.payload.goodsReceiptId}:inventory`,
    });
  }
}
