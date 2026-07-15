import { DomainEvent, DomainEventMetadata } from '../domain-event';

export enum PurchaseEventName {
  Received = 'purchase.received',
}

export type PurchaseReceivedPayload = {
  goodsReceiptId: string;
  purchaseOrderId: string;
  total: string;
  items: Array<{
    goodsReceiptItemId?: string;
    productId: string;
    stockItemId: string | null;
    unitId: string | null;
    quantity: string;
    baseQuantity: string;
    unitCost: string;
    batchCode: string | null;
    expiryDate: string | null;
    assets?: Array<{
      assetTag?: string | null;
      identifiers: Array<{
        identifierTypeId?: string;
        typeCode?: string;
        value: string;
        isPrimary?: boolean;
      }>;
    }>;
  }>;
};

export class PurchaseReceivedEvent extends DomainEvent<PurchaseReceivedPayload> {
  constructor(
    payload: PurchaseReceivedPayload,
    metadata?: DomainEventMetadata,
  ) {
    super(PurchaseEventName.Received, payload, metadata);
  }
}
