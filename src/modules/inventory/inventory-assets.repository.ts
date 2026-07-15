import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  InventoryAssetStatus,
  InventorySerialStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { InventoryTransaction } from './inventory.repository';

type PrismaExecutor = PrismaService | InventoryTransaction;

@Injectable()
export class InventoryAssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findIdentifierTypeByCode(code: string, transaction?: InventoryTransaction) {
    return this.client(transaction).inventoryIdentifierType.findUnique({
      where: { code },
    });
  }

  findIdentifierTypesByIds(
    ids: string[],
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryIdentifierType.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  findIdentifierTypesByCodes(
    codes: string[],
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryIdentifierType.findMany({
      where: {
        code: {
          in: codes,
        },
      },
    });
  }

  createIdentifierType(
    data: Prisma.InventoryIdentifierTypeUncheckedCreateInput,
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryIdentifierType.create({ data });
  }

  createAsset(
    data: Prisma.InventoryAssetUncheckedCreateInput,
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryAsset.create({
      data,
    });
  }

  createAssetIdentifier(
    data: Prisma.InventoryAssetIdentifierUncheckedCreateInput,
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryAssetIdentifier.create({ data });
  }

  createSerial(
    data: Prisma.InventorySerialUncheckedCreateInput,
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventorySerial.create({
      data,
    });
  }

  findAssetsByIds(ids: string[], transaction?: InventoryTransaction) {
    return this.client(transaction).inventoryAsset.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: {
        identifiers: {
          include: {
            identifierType: true,
          },
        },
        serialRecord: true,
      },
    });
  }

  findAssetsBySerialNumbers(
    productId: string,
    stockItemId: string | null,
    serialNumbers: string[],
    transaction?: InventoryTransaction,
  ) {
    return this.client(transaction).inventorySerial.findMany({
      where: {
        productId,
        ...(stockItemId ? { stockItemId } : {}),
        serialNumber: {
          in: serialNumbers,
        },
        assetId: {
          not: null,
        },
      },
      include: {
        asset: {
          include: {
            identifiers: {
              include: {
                identifierType: true,
              },
            },
            serialRecord: true,
          },
        },
      },
    });
  }

  updateAssetStatuses(
    assetIds: string[],
    fromStatuses: InventoryAssetStatus[],
    toStatus: InventoryAssetStatus,
    transaction: InventoryTransaction,
  ) {
    return this.client(transaction).inventoryAsset.updateMany({
      where: {
        id: {
          in: assetIds,
        },
        status: {
          in: fromStatuses,
        },
      },
      data: {
        status: toStatus,
      },
    });
  }

  updateSerialStatusesByAssetIds(
    assetIds: string[],
    fromStatuses: InventorySerialStatus[],
    toStatus: InventorySerialStatus,
    transaction: InventoryTransaction,
    referenceId?: string | null,
  ) {
    return this.client(transaction).inventorySerial.updateMany({
      where: {
        assetId: {
          in: assetIds,
        },
        status: {
          in: fromStatuses,
        },
      },
      data: {
        status: toStatus,
        referenceId:
          referenceId === undefined ? undefined : (referenceId ?? null),
      },
    });
  }

  private client(transaction?: InventoryTransaction): PrismaExecutor {
    return transaction ?? this.prisma;
  }
}
