import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  InventoryReferenceType,
  InventoryReservationStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type InventoryTransaction = Prisma.TransactionClient;

type PrismaExecutor = PrismaService | InventoryTransaction;
type InventoryIdentityLookup = {
  productId: string;
  stockItemId?: string | null;
};

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(
    callback: (transaction: InventoryTransaction) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(callback, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  findProductById(productId: string, transaction?: InventoryTransaction) {
    return this.client(transaction).product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        isActive: true,
      },
    });
  }

  findItemByIdentity(
    input: InventoryIdentityLookup,
    transaction?: InventoryTransaction,
  ) {
    if (input.stockItemId) {
      return this.client(transaction).inventoryItem.findUnique({
        where: { stockItemId: input.stockItemId },
      });
    }

    return this.client(transaction).inventoryItem.findFirst({
      where: {
        productId: input.productId,
        stockItemId: null,
      },
    });
  }

  findItemByProductId(productId: string, transaction?: InventoryTransaction) {
    return this.findItemByIdentity({ productId }, transaction);
  }

  findItems(params?: {
    productId?: string;
    stockItemId?: string;
  }, transaction?: InventoryTransaction) {
    return this.client(transaction).inventoryItem.findMany({
      where: {
        productId: params?.productId,
        stockItemId: params?.stockItemId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async upsertItem(
    input: InventoryIdentityLookup,
    transaction: InventoryTransaction,
  ) {
    await transaction.$queryRaw`
      SELECT id
      FROM products
      WHERE id = ${input.productId}
      FOR UPDATE
    `;

    if (input.stockItemId) {
      const existing = await this.client(transaction).inventoryItem.findUnique({
        where: { stockItemId: input.stockItemId },
      });

      if (existing) {
        return existing;
      }

      return this.client(transaction).inventoryItem.create({
        data: {
          productId: input.productId,
          stockItemId: input.stockItemId,
          quantityOnHand: 0,
          reservedQuantity: 0,
        },
      });
    }

    const existing = await this.client(transaction).inventoryItem.findFirst({
      where: {
        productId: input.productId,
        stockItemId: null,
      },
    });

    if (existing) {
      return existing;
    }

    return this.client(transaction).inventoryItem.create({
      data: {
        productId: input.productId,
        stockItemId: null,
        quantityOnHand: 0,
        reservedQuantity: 0,
      },
    });
  }

  incrementItemQuantity(
    input: InventoryIdentityLookup,
    quantity: Prisma.Decimal,
    transaction: InventoryTransaction,
  ) {
    if (input.stockItemId) {
      return this.client(transaction).inventoryItem.update({
        where: {
          stockItemId: input.stockItemId,
        },
        data: {
          quantityOnHand: {
            increment: quantity,
          },
        },
      });
    }

    return this.client(transaction).inventoryItem.updateMany({
      where: {
        productId: input.productId,
        stockItemId: null,
      },
      data: {
        quantityOnHand: {
          increment: quantity,
        },
      },
    });
  }

  decrementItemQuantity(
    input: InventoryIdentityLookup,
    quantity: Prisma.Decimal,
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryItem.updateMany({
      where: {
        ...this.itemWhereInput(input),
        quantityOnHand: {
          gte: quantity,
        },
      },
      data: {
        quantityOnHand: {
          decrement: quantity,
        },
      },
    });
  }

  reserveItemQuantity(
    input: InventoryIdentityLookup,
    quantity: Prisma.Decimal,
    transaction: InventoryTransaction,
  ) {
    if (input.stockItemId) {
      return this.client(transaction).$executeRaw`
        UPDATE inventory_items
        SET reserved_quantity = reserved_quantity + ${quantity}
        WHERE stock_item_id = ${input.stockItemId}
          AND (quantity_on_hand - reserved_quantity) >= ${quantity}
      `;
    }

    return this.client(transaction).$executeRaw`
      UPDATE inventory_items
      SET reserved_quantity = reserved_quantity + ${quantity}
      WHERE product_id = ${input.productId}
        AND stock_item_id IS NULL
        AND (quantity_on_hand - reserved_quantity) >= ${quantity}
    `;
  }

  releaseReservedQuantity(
    input: InventoryIdentityLookup,
    quantity: Prisma.Decimal,
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryItem.updateMany({
      where: {
        ...this.itemWhereInput(input),
        reservedQuantity: {
          gte: quantity,
        },
      },
      data: {
        reservedQuantity: {
          decrement: quantity,
        },
      },
    });
  }

  createBatch(
    data: Prisma.InventoryBatchUncheckedCreateInput,
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryBatch.create({
      data,
    });
  }

  findExpiringFifoBatches(
    productId: string,
    transaction: InventoryTransaction,
    stockItemId?: string | null,
  ) {
    return this.client(transaction).inventoryBatch.findMany({
      where: {
        productId,
        ...this.stockItemFilter(stockItemId),
        expiryDate: {
          gt: new Date(),
        },
        quantityRemaining: {
          gt: 0,
        },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findNonExpiringFifoBatches(
    productId: string,
    transaction: InventoryTransaction,
    stockItemId?: string | null,
  ) {
    return this.client(transaction).inventoryBatch.findMany({
      where: {
        productId,
        ...this.stockItemFilter(stockItemId),
        expiryDate: null,
        quantityRemaining: {
          gt: 0,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  decrementBatchQuantity(
    batchId: string,
    quantity: Prisma.Decimal,
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryBatch.updateMany({
      where: {
        id: batchId,
        quantityRemaining: {
          gte: quantity,
        },
      },
      data: {
        quantityRemaining: {
          decrement: quantity,
        },
      },
    });
  }

  createMovement(
    data: Prisma.InventoryMovementUncheckedCreateInput,
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryMovement.create({
      data,
    });
  }

  findMovementByEventKey(
    eventKey: string,
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryMovement.findUnique({
      where: { eventKey },
    });
  }

  findLatestMovementByReference(
    productId: string,
    referenceType: InventoryReferenceType,
    referenceId: string,
    stockItemId?: string | null,
  ) {
    return this.prisma.inventoryMovement.findFirst({
      where: {
        productId,
        ...this.stockItemFilter(stockItemId),
        referenceType,
        referenceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findLatestBatchWithCost(productId: string, stockItemId?: string | null) {
    return this.prisma.inventoryBatch.findFirst({
      where: {
        productId,
        ...this.stockItemFilter(stockItemId),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        unitCost: true,
      },
    });
  }

  createSerials(
    data: Prisma.InventorySerialCreateManyInput[],
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventorySerial.createMany({
      data,
      skipDuplicates: false,
    });
  }

  markSerialsSold(
    productId: string,
    serialNumbers: string[],
    referenceId: string,
    transaction: InventoryTransaction,
    stockItemId?: string | null,
  ) {
    return this.client(transaction).inventorySerial.updateMany({
      where: {
        productId,
        ...(stockItemId ? { stockItemId } : {}),
        serialNumber: {
          in: serialNumbers,
        },
        status: 'AVAILABLE',
      },
      data: {
        status: 'SOLD',
        referenceId,
      },
    });
  }

  markSerialsAvailable(
    productId: string,
    serialNumbers: string[],
    transaction: InventoryTransaction,
    stockItemId?: string | null,
  ) {
    return this.client(transaction).inventorySerial.updateMany({
      where: {
        productId,
        ...(stockItemId ? { stockItemId } : {}),
        serialNumber: {
          in: serialNumbers,
        },
        status: 'SOLD',
      },
      data: {
        status: 'AVAILABLE',
        referenceId: null,
      },
    });
  }

  findReservationByKey(
    reservationKey: string,
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryReservation.findUnique({
      where: { reservationKey },
    });
  }

  findStockItemById(
    stockItemId: string,
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).stockItem.findUnique({
      where: { id: stockItemId },
      select: {
        id: true,
        productId: true,
        baseUnitId: true,
      },
    });
  }

  findStockItemUnit(
    stockItemId: string,
    unitId: string,
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).stockItemUnit.findUnique({
      where: {
        stockItemId_unitId: {
          stockItemId,
          unitId,
        },
      },
      select: {
        stockItemId: true,
        unitId: true,
        conversionToBase: true,
      },
    });
  }

  createReservation(
    data: Prisma.InventoryReservationUncheckedCreateInput,
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryReservation.create({
      data,
    });
  }

  releaseReservation(
    reservationKey: string,
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryReservation.updateMany({
      where: {
        reservationKey,
        status: InventoryReservationStatus.ACTIVE,
      },
      data: {
        status: InventoryReservationStatus.RELEASED,
        releasedAt: new Date(),
      },
    });
  }

  private client(transaction?: InventoryTransaction): PrismaExecutor {
    return transaction ?? this.prisma;
  }

  private itemWhereInput(input: InventoryIdentityLookup) {
    if (input.stockItemId) {
      return {
        stockItemId: input.stockItemId,
      };
    }

    return {
      productId: input.productId,
      stockItemId: null,
    };
  }

  private stockItemFilter(stockItemId?: string | null) {
    if (stockItemId === undefined) {
      return {};
    }

    return { stockItemId };
  }
}
