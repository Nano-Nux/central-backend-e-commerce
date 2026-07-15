import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { BarcodeOwnerType } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BarcodeRegistryRepository } from './barcode-registry.repository';

@Injectable()
export class BarcodeRegistryService {
  constructor(
    private readonly barcodeRegistryRepository: BarcodeRegistryRepository,
    private readonly prisma: PrismaService,
  ) {}

  async register(input: {
    code: string;
    symbology: string;
    ownerType: BarcodeOwnerType;
    ownerId: string;
    productId?: string;
    variantId?: string;
    stockItemId?: string;
    stockItemUnitId?: string;
    inventoryAssetId?: string;
    inventoryBatchId?: string;
    isPrimary?: boolean;
    isGenerated?: boolean;
  }) {
    const normalizedCode = this.normalizeBarcode(input.code);
    const existing =
      await this.barcodeRegistryRepository.findAnyByNormalizedCode(normalizedCode);

    if (existing) {
      return existing;
    }

    if (!input.ownerId.trim()) {
      throw new BadRequestException('Barcode owner ID is required');
    }

    return this.barcodeRegistryRepository.create({
      id: randomUUID(),
      code: input.code.trim(),
      normalizedCode,
      symbology: input.symbology.trim().toUpperCase(),
      ownerType: input.ownerType,
      ownerId: input.ownerId.trim(),
      productId: input.productId ?? null,
      variantId: input.variantId ?? null,
      stockItemId: input.stockItemId ?? null,
      stockItemUnitId: input.stockItemUnitId ?? null,
      inventoryAssetId: input.inventoryAssetId ?? null,
      inventoryBatchId: input.inventoryBatchId ?? null,
      isPrimary: input.isPrimary ?? false,
      isGenerated: input.isGenerated ?? false,
    });
  }

  async lookup(code: string) {
    return this.barcodeRegistryRepository.findByNormalizedCode(
      this.normalizeBarcode(code),
    );
  }

  async resolveProductSelection(code: string) {
    const normalizedCode = this.normalizeBarcode(code);
    const registryMatch =
      await this.barcodeRegistryRepository.findByNormalizedCode(normalizedCode);

    if (registryMatch) {
      const fromRegistry = await this.selectionFromRegistry(registryMatch);

      if (fromRegistry) {
        return fromRegistry;
      }
    }

    const product = await this.prisma.product.findFirst({
      where: {
        barcode: normalizedCode,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (product) {
      return {
        productId: product.id,
        variantId: null,
        stockItemId: registryMatch?.stockItemId ?? null,
        unitId: null,
      };
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        barcode: normalizedCode,
        product: {
          isActive: true,
        },
      },
      select: {
        id: true,
        productId: true,
      },
    });

    if (!variant) {
      return null;
    }

    return {
      productId: variant.productId,
      variantId: variant.id,
      stockItemId: registryMatch?.stockItemId ?? null,
      unitId: null,
    };
  }

  private normalizeBarcode(code: string) {
    const normalized = code.trim().replace(/\s+/g, '').toUpperCase();

    if (!normalized) {
      throw new BadRequestException('Barcode is required');
    }

    return normalized;
  }

  private async selectionFromRegistry(registryMatch: Awaited<ReturnType<BarcodeRegistryRepository['findByNormalizedCode']>>) {
    if (!registryMatch) {
      return null;
    }

    if (registryMatch.productId) {
      return {
        productId: registryMatch.productId,
        variantId: registryMatch.variantId ?? null,
        stockItemId: registryMatch.stockItemId ?? null,
        unitId: null,
      };
    }

    if (registryMatch.stockItemUnitId) {
      const stockItemUnit = await this.prisma.stockItemUnit.findUnique({
        where: { id: registryMatch.stockItemUnitId },
        select: {
          unitId: true,
          stockItem: {
            select: {
              id: true,
              productId: true,
              variantId: true,
            },
          },
        },
      });

      if (stockItemUnit?.stockItem) {
        return {
          productId: stockItemUnit.stockItem.productId,
          variantId: stockItemUnit.stockItem.variantId ?? null,
          stockItemId: stockItemUnit.stockItem.id,
          unitId: stockItemUnit.unitId,
        };
      }
    }

    if (registryMatch.stockItemId) {
      const stockItem = await this.prisma.stockItem.findUnique({
        where: { id: registryMatch.stockItemId },
        select: {
          id: true,
          productId: true,
          variantId: true,
        },
      });

      if (stockItem) {
        return {
          productId: stockItem.productId,
          variantId: stockItem.variantId ?? null,
          stockItemId: stockItem.id,
          unitId: null,
        };
      }
    }

    return null;
  }
}
