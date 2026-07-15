import { DomainEvent, DomainEventMetadata } from '../domain-event';

export enum OrderEventName {
  Created = 'order.created',
  Paid = 'order.paid',
  Completed = 'order.completed',
  Cancelled = 'order.cancelled',
  Refunded = 'order.refunded',
}

export type OrderEventItemPayload = {
  id: string;
  productId: string;
  stockItemId: string | null;
  variantId: string | null;
  unitId: string | null;
  assetIds: string[];
  isStockTracked: boolean;
  isSerialized: boolean;
  serialNumbers: string[];
  quantity: string;
  baseQuantity: string;
  unitPrice: string;
  totalPrice: string;
};

export type OrderEventPayload = {
  id: string;
  customerId: string | null;
  type: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  status: string;
  source: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  currency: string;
  items: OrderEventItemPayload[];
};

export class OrderCreatedEvent extends DomainEvent<OrderEventPayload> {
  constructor(payload: OrderEventPayload, metadata?: DomainEventMetadata) {
    super(OrderEventName.Created, payload, metadata);
  }
}

export class OrderPaidEvent extends DomainEvent<OrderEventPayload> {
  constructor(payload: OrderEventPayload, metadata?: DomainEventMetadata) {
    super(OrderEventName.Paid, payload, metadata);
  }
}

export class OrderCompletedEvent extends DomainEvent<OrderEventPayload> {
  constructor(payload: OrderEventPayload, metadata?: DomainEventMetadata) {
    super(OrderEventName.Completed, payload, metadata);
  }
}

export class OrderCancelledEvent extends DomainEvent<OrderEventPayload> {
  constructor(payload: OrderEventPayload, metadata?: DomainEventMetadata) {
    super(OrderEventName.Cancelled, payload, metadata);
  }
}

export class OrderRefundedEvent extends DomainEvent<OrderEventPayload> {
  constructor(payload: OrderEventPayload, metadata?: DomainEventMetadata) {
    super(OrderEventName.Refunded, payload, metadata);
  }
}
