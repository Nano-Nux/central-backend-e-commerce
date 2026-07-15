import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { BatchService } from '../inventory-batch/batch.service';
import {
  InventoryRepository,
  InventoryTransaction,
} from '../inventory/inventory.repository';

export type FifoAllocation = {
  batchId: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
};

@Injectable()
export class FifoService {
  constructor(
    private readonly batchService: BatchService,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  async consume(
    input: {
      productId: string;
      quantity: Prisma.Decimal;
      stockItemId?: string | null;
    },
    transaction: InventoryTransaction,
  ): Promise<FifoAllocation[]> {
    if (input.quantity.lte(0)) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    let remainingQuantity = input.quantity;
    const allocations: FifoAllocation[] = [];
    const batches = await this.findCandidateBatches(input, transaction);

    for (const batch of batches) {
      if (remainingQuantity.lte(0)) {
        break;
      }

      const consumedQuantity = batch.quantityRemaining.lt(remainingQuantity)
        ? batch.quantityRemaining
        : remainingQuantity;

      const result = await this.inventoryRepository.decrementBatchQuantity(
        batch.id,
        consumedQuantity,
        transaction,
      );

      if (result.count !== 1) {
        throw new ConflictException('Inventory batch was updated concurrently');
      }

      allocations.push({
        batchId: batch.id,
        quantity: consumedQuantity,
        unitCost: batch.unitCost,
      });

      remainingQuantity = remainingQuantity.minus(consumedQuantity);
    }

    if (remainingQuantity.gt(0)) {
      throw new BadRequestException('Insufficient inventory');
    }

    return allocations;
  }

  private async findCandidateBatches(
    input: {
      productId: string;
      stockItemId?: string | null;
    },
    transaction: InventoryTransaction,
  ) {
    if (input.stockItemId) {
      const stockItemBatches = await this.batchService.findFifoBatches(
        input.productId,
        transaction,
        input.stockItemId,
      );

      if (stockItemBatches.length > 0) {
        return stockItemBatches;
      }

      return [];
    }

    return this.batchService.findFifoBatches(input.productId, transaction);
  }
}
