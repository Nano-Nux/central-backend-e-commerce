export const SystemEvents = {
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  ORDER_COMPLETED: 'order.completed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REFUNDED: 'order.refunded',
  PAYMENT_RECORDED: 'payment.recorded',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  INVENTORY_STOCK_IN: 'inventory.stock-in',
  INVENTORY_STOCK_OUT: 'inventory.stock-out-recorded',
  INVENTORY_ADJUSTED: 'inventory.adjusted',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RESERVATION_RELEASED: 'inventory.reservation-released',
  PURCHASE_RECEIVED: 'purchase.received',
  JOURNAL_ENTRY_CREATED: 'journal.entry-created',
  CUSTOMER_ACTIVITY_RECORDED: 'customer.activity-recorded',
  PURCHASE_ORDER_CREATED: 'purchase-order.created',
  PURCHASE_ORDER_APPROVED: 'purchase-order.approved',
  PURCHASE_ORDER_CANCELLED: 'purchase-order.cancelled',
  SUPPLIER_INVOICE_CREATED: 'supplier-invoice.created',
  SUPPLIER_PAYMENT_CREATED: 'supplier-payment.created',
} as const;

export type SystemEventName = (typeof SystemEvents)[keyof typeof SystemEvents];

export const LegacyEventAliases: Record<SystemEventName, string[]> = {
  [SystemEvents.ORDER_CREATED]: ['OrderCreated', 'ORDER_CREATED'],
  [SystemEvents.ORDER_PAID]: ['OrderPaid', 'ORDER_PAID'],
  [SystemEvents.ORDER_COMPLETED]: ['OrderCompleted', 'ORDER_COMPLETED'],
  [SystemEvents.ORDER_CANCELLED]: ['OrderCancelled', 'ORDER_CANCELLED'],
  [SystemEvents.ORDER_REFUNDED]: [],
  [SystemEvents.PAYMENT_RECORDED]: [],
  [SystemEvents.PAYMENT_SUCCEEDED]: ['PAYMENT_RECEIVED'],
  [SystemEvents.PAYMENT_FAILED]: ['PAYMENT_FAILED'],
  [SystemEvents.PAYMENT_REFUNDED]: [],
  [SystemEvents.INVENTORY_STOCK_IN]: ['INVENTORY_STOCK_IN'],
  [SystemEvents.INVENTORY_STOCK_OUT]: [
    'INVENTORY_STOCK_OUT',
    'inventory.stock-out',
  ],
  [SystemEvents.INVENTORY_ADJUSTED]: ['INVENTORY_ADJUSTED'],
  [SystemEvents.INVENTORY_RESERVED]: [],
  [SystemEvents.INVENTORY_RESERVATION_RELEASED]: [],
  [SystemEvents.PURCHASE_RECEIVED]: ['PurchaseReceived', 'GOODS_RECEIVED'],
  [SystemEvents.JOURNAL_ENTRY_CREATED]: ['ACCOUNTING_ENTRY_CREATED'],
  [SystemEvents.CUSTOMER_ACTIVITY_RECORDED]: [],
  [SystemEvents.PURCHASE_ORDER_CREATED]: [],
  [SystemEvents.PURCHASE_ORDER_APPROVED]: [],
  [SystemEvents.PURCHASE_ORDER_CANCELLED]: [],
  [SystemEvents.SUPPLIER_INVOICE_CREATED]: [],
  [SystemEvents.SUPPLIER_PAYMENT_CREATED]: [],
};

const canonicalNames = new Set<string>(Object.values(SystemEvents));
const legacyToCanonical = new Map<string, SystemEventName>();

for (const [canonicalName, legacyNames] of Object.entries(LegacyEventAliases)) {
  for (const legacyName of legacyNames) {
    legacyToCanonical.set(legacyName, canonicalName as SystemEventName);
  }
}

export function canonicalizeEventName(eventName: string) {
  if (canonicalNames.has(eventName)) {
    return eventName as SystemEventName;
  }

  return legacyToCanonical.get(eventName) ?? eventName;
}

export function eventNameCandidates(eventName: string) {
  const canonicalName = canonicalizeEventName(eventName);

  if (!canonicalNames.has(canonicalName)) {
    return [eventName];
  }

  return [canonicalName, ...(LegacyEventAliases[canonicalName] ?? [])];
}
