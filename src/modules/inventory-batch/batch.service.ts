import { Injectable } from '@nestjs/common';

import {
  InventoryRepository,
  InventoryTransaction,
} from '../inventory/inventory.repository';

@Injectable()
export class BatchService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async findFifoBatches(
    productId: string,
    transaction: InventoryTransaction,
    stockItemId?: string | null,
  ) {
    const expiringBatches =
      await this.inventoryRepository.findExpiringFifoBatches(
        productId,
        transaction,
        stockItemId,
      );

    if (expiringBatches.length === 0) {
      return this.inventoryRepository.findNonExpiringFifoBatches(
        productId,
        transaction,
        stockItemId,
      );
    }

    const nonExpiringBatches =
      await this.inventoryRepository.findNonExpiringFifoBatches(
        productId,
        transaction,
        stockItemId,
      );

    return [...expiringBatches, ...nonExpiringBatches];
  }
}
