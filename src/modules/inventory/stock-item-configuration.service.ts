import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StockTrackingMode } from '../../../generated/prisma/enums';

export type EffectiveStockItemConfiguration = {
  stockItemId: string;
  productId: string;
  variantId: string | null;
  baseUnitId: string | null;
  trackInventory: boolean;
  trackBatches: boolean;
  trackExpiry: boolean;
  trackUniqueAssets: boolean;
  trackReservations: boolean;
  allowUnitConversions: boolean;
  allowPackBreaking: boolean;
  allowMultipleBarcodes: boolean;
  trackingMode: StockTrackingMode;
  identifierRules: Array<{
    id: string;
    identifierTypeId: string;
    code: string;
    name: string;
    isRequired: boolean;
    minCount: number;
    maxCount: number | null;
    validationRegex: string | null;
    isActive: boolean;
  }>;
};

@Injectable()
export class StockItemConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveConfiguration(stockItemId: string) {
    const stockItem = await this.prisma.stockItem.findUnique({
      where: { id: stockItemId },
      include: {
        product: {
          select: {
            id: true,
            isStockTracked: true,
            isSerialized: true,
          },
        },
        configuration: true,
        identifierRules: {
          include: {
            identifierType: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!stockItem) {
      throw new NotFoundException('Stock item not found');
    }

    const config = stockItem.configuration;
    const trackUniqueAssets =
      config?.trackUniqueAssets ??
      (stockItem.trackingMode === StockTrackingMode.ASSET ||
        stockItem.product.isSerialized);

    return {
      stockItemId: stockItem.id,
      productId: stockItem.productId,
      variantId: stockItem.variantId ?? null,
      baseUnitId: stockItem.baseUnitId ?? null,
      trackInventory: stockItem.trackInventory && stockItem.product.isStockTracked,
      trackBatches:
        config?.trackBatches ?? stockItem.trackingMode === StockTrackingMode.BATCH,
      trackExpiry: config?.trackExpiry ?? false,
      trackUniqueAssets,
      trackReservations: config?.trackReservations ?? true,
      allowUnitConversions: config?.allowUnitConversions ?? false,
      allowPackBreaking: config?.allowPackBreaking ?? false,
      allowMultipleBarcodes: config?.allowMultipleBarcodes ?? false,
      trackingMode: stockItem.trackingMode,
      identifierRules: stockItem.identifierRules.map((rule) => ({
        id: rule.id,
        identifierTypeId: rule.identifierTypeId,
        code: rule.identifierType.code,
        name: rule.identifierType.name,
        isRequired: rule.isRequired,
        minCount: rule.minCount,
        maxCount: rule.maxCount,
        validationRegex: rule.identifierType.validationRegex,
        isActive: rule.identifierType.isActive,
      })),
    } satisfies EffectiveStockItemConfiguration;
  }

  async assertUnitConfiguration(input: {
    stockItemId: string | null;
    unitId: string | null;
  }) {
    if (!input.stockItemId || !input.unitId) {
      return null;
    }

    const config = await this.getEffectiveConfiguration(input.stockItemId);

    if (
      !config.allowUnitConversions &&
      config.baseUnitId &&
      input.unitId !== config.baseUnitId
    ) {
      throw new BadRequestException(
        'Unit conversions are not enabled for this stock item',
      );
    }

    return config;
  }

  async assertSalesConfiguration(input: {
    stockItemId: string | null;
    unitId: string | null;
    assetIds?: string[];
    serialNumbers?: string[];
  }) {
    if (!input.stockItemId) {
      return null;
    }

    const config = await this.assertUnitConfiguration(input);

    if (
      config?.trackUniqueAssets &&
      !input.serialNumbers?.length &&
      !input.assetIds?.length
    ) {
      throw new BadRequestException(
        'Unique asset tracked stock items require asset selection',
      );
    }

    return config;
  }

  async assertReceiptConfiguration(input: {
    stockItemId: string | null;
    unitId: string | null;
    batchCode?: string;
    expiryDate?: string | Date | null;
  }) {
    if (!input.stockItemId) {
      return null;
    }

    const config = await this.assertUnitConfiguration(input);

    if (config?.trackBatches && !input.batchCode?.trim()) {
      throw new BadRequestException(
        'Batch code is required for this stock item',
      );
    }

    if (config?.trackExpiry && !input.expiryDate) {
      throw new BadRequestException(
        'Expiry date is required for this stock item',
      );
    }

    return config;
  }
}
