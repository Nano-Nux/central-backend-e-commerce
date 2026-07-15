import { Injectable } from '@nestjs/common';

import { InventoryReferenceType } from '../../../generated/prisma/enums';
import { DomainEvent } from '../../infrastructure/event-bus/domain-event';
import {
  PurchaseEventName,
  PurchaseReceivedPayload,
} from '../../infrastructure/event-bus/events/purchase-received.event';
import { EventProcessingMode } from '../../infrastructure/event-bus/event-handler.interface';
import { OnEvent } from '../../infrastructure/event-bus/on-event.decorator';
import { InventoryService } from './inventory.service';

@Injectable()
export class InventoryPurchaseEventsHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  @OnEvent(PurchaseEventName.Received, {
    mode: EventProcessingMode.SYNC,
    retries: 2,
    priority: 10,
  })
  async stockInFromPurchase(event: DomainEvent<PurchaseReceivedPayload>) {
    for (const item of event.payload.items) {
      await this.inventoryService.stockIn(
        {
          productId: item.productId,
          stockItemId: item.stockItemId,
          unitId: item.unitId,
          batchCode:
            item.batchCode ?? `GR-${event.payload.goodsReceiptId}-${item.productId}`,
          eventKey: `purchase-received:${event.payload.goodsReceiptId}:${item.goodsReceiptItemId ?? item.productId}:stock-in`,
          quantity: item.quantity,
          unitCost: item.unitCost,
          expiryDate: item.expiryDate,
          assets: item.assets?.map((asset) => ({
            assetTag: asset.assetTag ?? undefined,
            identifiers: asset.identifiers.map((identifier) => ({
              identifierTypeId: identifier.identifierTypeId,
              typeCode: identifier.typeCode,
              value: identifier.value,
              isPrimary: identifier.isPrimary,
            })),
          })),
          referenceType: InventoryReferenceType.PURCHASE,
          referenceId: event.payload.goodsReceiptId,
        },
        {
          actorId: event.metadata?.userId,
        },
      );
    }
  }
}
