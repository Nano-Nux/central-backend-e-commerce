import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import {
  BarcodeOwnerType,
  StockTrackingMode,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BarcodeRegistryService } from './barcode-registry.service';
import { StockItemsService } from './stock-items.service';
import { StockItemConfigurationService } from './stock-item-configuration.service';
import { UnitsService } from './units.service';

@Injectable()
export class InventoryAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockItemsService: StockItemsService,
    private readonly stockItemConfigurationService: StockItemConfigurationService,
    private readonly barcodeRegistryService: BarcodeRegistryService,
    private readonly unitsService: UnitsService,
    private readonly auditService: AuditService,
  ) {}

  listStockItems(params?: { productId?: string; variantId?: string; isActive?: boolean }) {
    return this.stockItemsService.list(params);
  }

  async provisionStockItem(input: { productId: string; variantId?: string | null }) {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        variants: input.variantId
          ? {
              where: { id: input.variantId },
              take: 1,
            }
          : false,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (input.variantId && product.variants.length === 0) {
      throw new NotFoundException('Product variant not found');
    }

    const variant = input.variantId ? product.variants[0] : null;

    return this.stockItemsService.getOrCreateFromProduct({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      variantSku: variant?.sku ?? null,
      trackInventory: product.isStockTracked,
      trackingMode: product.isSerialized
        ? StockTrackingMode.ASSET
        : StockTrackingMode.SIMPLE,
    });
  }

  getStockItemConfiguration(stockItemId: string) {
    return this.stockItemConfigurationService.getEffectiveConfiguration(stockItemId);
  }

  async updateStockItemConfiguration(
    stockItemId: string,
    input: {
      trackBatches?: boolean;
      trackExpiry?: boolean;
      trackUniqueAssets?: boolean;
      trackReservations?: boolean;
      allowUnitConversions?: boolean;
      allowPackBreaking?: boolean;
      allowMultipleBarcodes?: boolean;
      trackingMode?: StockTrackingMode;
      baseUnitId?: string | null;
    },
  ) {
    await this.stockItemsService.getById(stockItemId);

    if (input.trackExpiry && input.trackBatches === false) {
      throw new BadRequestException('Expiry tracking requires batch tracking');
    }

    if (input.trackingMode) {
      await this.prisma.stockItem.update({
        where: { id: stockItemId },
        data: {
          trackingMode: input.trackingMode,
          baseUnitId:
            input.baseUnitId === undefined ? undefined : input.baseUnitId,
        },
      });
    } else if (input.baseUnitId !== undefined) {
      await this.prisma.stockItem.update({
        where: { id: stockItemId },
        data: {
          baseUnitId: input.baseUnitId,
        },
      });
    }

    await this.prisma.stockItemConfiguration.upsert({
      where: { stockItemId },
      create: {
        stockItemId,
        trackBatches: input.trackBatches ?? false,
        trackExpiry: input.trackExpiry ?? false,
        trackUniqueAssets: input.trackUniqueAssets ?? false,
        trackReservations: input.trackReservations ?? true,
        allowUnitConversions: input.allowUnitConversions ?? false,
        allowPackBreaking: input.allowPackBreaking ?? false,
        allowMultipleBarcodes: input.allowMultipleBarcodes ?? false,
      },
      update: {
        trackBatches: input.trackBatches,
        trackExpiry: input.trackExpiry,
        trackUniqueAssets: input.trackUniqueAssets,
        trackReservations: input.trackReservations,
        allowUnitConversions: input.allowUnitConversions,
        allowPackBreaking: input.allowPackBreaking,
        allowMultipleBarcodes: input.allowMultipleBarcodes,
      },
    });

    return this.getStockItemConfiguration(stockItemId);
  }

  async listIdentifierTypes(q?: string) {
    return this.prisma.inventoryIdentifierType.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q } },
              { name: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : undefined,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createIdentifierType(input: {
    code: string;
    name: string;
    description?: string;
    validationRegex?: string;
  }) {
    const code = this.normalizeCode(input.code);

    try {
      return await this.prisma.inventoryIdentifierType.create({
        data: {
          id: randomUUID(),
          code,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          validationRegex: input.validationRegex?.trim() || null,
        },
      });
    } catch (error) {
      this.handleUniqueConflict(error, 'Identifier type already exists');
    }
  }

  async updateIdentifierType(
    id: string,
    input: {
      name?: string;
      description?: string | null;
      validationRegex?: string | null;
    },
  ) {
    await this.ensureIdentifierType(id);

    return this.prisma.inventoryIdentifierType.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description:
          input.description === undefined ? undefined : input.description?.trim() || null,
        validationRegex:
          input.validationRegex === undefined
            ? undefined
            : input.validationRegex?.trim() || null,
      },
    });
  }

  async archiveIdentifierType(id: string) {
    await this.ensureIdentifierType(id);

    return this.prisma.inventoryIdentifierType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async restoreIdentifierType(id: string) {
    await this.ensureIdentifierType(id);

    return this.prisma.inventoryIdentifierType.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async listStockItemIdentifierRules(stockItemId: string) {
    await this.stockItemsService.getById(stockItemId);

    return this.prisma.stockItemIdentifierRule.findMany({
      where: { stockItemId },
      include: {
        identifierType: true,
      },
      orderBy: [{ isRequired: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async upsertStockItemIdentifierRule(
    stockItemId: string,
    input: {
      identifierTypeId: string;
      isRequired?: boolean;
      minCount?: number;
      maxCount?: number | null;
    },
  ) {
    await this.stockItemsService.getById(stockItemId);
    const identifierType = await this.ensureIdentifierType(input.identifierTypeId);

    if (!identifierType.isActive) {
      throw new BadRequestException('Identifier type is archived');
    }

    const minCount = input.minCount ?? 1;
    const maxCount = input.maxCount ?? null;

    if (minCount < 0) {
      throw new BadRequestException('Minimum count must not be negative');
    }

    if (maxCount !== null && maxCount < minCount) {
      throw new BadRequestException(
        'Maximum count must be greater than or equal to minimum count',
      );
    }

    return this.prisma.stockItemIdentifierRule.upsert({
      where: {
        stockItemId_identifierTypeId: {
          stockItemId,
          identifierTypeId: input.identifierTypeId,
        },
      },
      create: {
        id: randomUUID(),
        stockItemId,
        identifierTypeId: input.identifierTypeId,
        isRequired: input.isRequired ?? true,
        minCount,
        maxCount,
      },
      update: {
        isRequired: input.isRequired,
        minCount,
        maxCount,
      },
      include: {
        identifierType: true,
      },
    });
  }

  async removeStockItemIdentifierRule(stockItemId: string, identifierTypeId: string) {
    await this.stockItemsService.getById(stockItemId);

    return this.prisma.stockItemIdentifierRule.delete({
      where: {
        stockItemId_identifierTypeId: {
          stockItemId,
          identifierTypeId,
        },
      },
    });
  }

  listMeasurementGroups() {
    return this.prisma.measurementGroup.findMany({
      include: { units: true },
      orderBy: { name: 'asc' },
    });
  }

  async createMeasurementGroup(input: { code: string; name: string }) {
    return this.unitsService.createMeasurementGroup(input);
  }

  async updateMeasurementGroup(id: string, input: { name?: string }) {
    const existing = await this.prisma.measurementGroup.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Measurement group not found');
    }

    return this.prisma.measurementGroup.update({
      where: { id },
      data: {
        name: input.name?.trim(),
      },
    });
  }

  listUnits() {
    return this.prisma.unitDefinition.findMany({
      include: { measurementGroup: true },
      orderBy: { name: 'asc' },
    });
  }

  async createUnit(input: {
    code: string;
    name: string;
    symbol?: string;
    measurementGroupId?: string;
    allowsDecimal?: boolean;
  }) {
    return this.unitsService.createUnit(input);
  }

  async updateUnit(
    id: string,
    input: {
      name?: string;
      symbol?: string | null;
      measurementGroupId?: string | null;
      allowsDecimal?: boolean;
    },
  ) {
    const existing = await this.prisma.unitDefinition.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Unit not found');
    }

    const updated = await this.prisma.unitDefinition.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        symbol:
          input.symbol === undefined ? undefined : input.symbol?.trim() || null,
        measurementGroupId:
          input.measurementGroupId === undefined
            ? undefined
            : input.measurementGroupId,
        allowsDecimal: input.allowsDecimal,
      },
    });

    this.auditService.logUpdate('UNIT', id, existing, updated);

    return updated;
  }

  async assignStockItemUnit(input: {
    stockItemId: string;
    unitId: string;
    conversionToBase: string | number | Prisma.Decimal;
    isBaseUnit?: boolean;
    isSalesUnit?: boolean;
    isPurchaseUnit?: boolean;
    allowsFractional?: boolean;
    position?: number;
  }) {
    return this.unitsService.assignUnit(input);
  }

  listStockItemUnits(stockItemId: string) {
    return this.unitsService.listStockItemUnits(stockItemId);
  }

  async addStockItemConversion(input: {
    stockItemId: string;
    fromUnitId: string;
    toUnitId: string;
    factor: string | number | Prisma.Decimal;
  }) {
    return this.unitsService.addConversion(input);
  }

  listStockItemConversions(stockItemId: string) {
    return this.prisma.stockItemUnitConversion.findMany({
      where: { stockItemId },
      include: {
        fromUnit: true,
        toUnit: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listBarcodes(filters?: {
    ownerType?: BarcodeOwnerType;
    productId?: string;
    stockItemId?: string;
    q?: string;
    activeOnly?: boolean;
  }) {
    return this.prisma.barcodeRegistry.findMany({
      where: {
        ownerType: filters?.ownerType,
        productId: filters?.productId,
        stockItemId: filters?.stockItemId,
        isActive: filters?.activeOnly ? true : undefined,
        OR: filters?.q
          ? [
              { code: { contains: filters.q } },
              { normalizedCode: { contains: filters.q.toUpperCase() } },
            ]
          : undefined,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async registerBarcode(input: {
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
    await this.assertBarcodeOwner(input);
    await this.assertBarcodeMultiplicity(input);

    return this.prisma.$transaction(async (transaction) => {
      const created = await this.barcodeRegistryService.register(input);

      if (input.isPrimary) {
        await transaction.barcodeRegistry.updateMany({
          where: {
            ownerType: input.ownerType,
            ownerId: input.ownerId,
            id: { not: created.id },
          },
          data: { isPrimary: false },
        });

        const updated = await transaction.barcodeRegistry.update({
          where: { id: created.id },
          data: { isPrimary: true, isActive: true },
        });

        this.auditService.logCreate('BARCODE', updated.id, updated);

        return updated;
      }

      this.auditService.logCreate('BARCODE', created.id, created);

      return created;
    });
  }

  async generateBarcode(input: {
    ownerType: BarcodeOwnerType;
    ownerId: string;
    productId?: string;
    variantId?: string;
    stockItemId?: string;
    stockItemUnitId?: string;
    inventoryAssetId?: string;
    inventoryBatchId?: string;
    isPrimary?: boolean;
  }) {
    const code = `BC${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;

    return this.registerBarcode({
      ...input,
      code,
      symbology: 'CODE128',
      isGenerated: true,
    });
  }

  async setPrimaryBarcode(id: string) {
    const barcode = await this.ensureBarcode(id);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.barcodeRegistry.updateMany({
        where: {
          ownerType: barcode.ownerType,
          ownerId: barcode.ownerId,
          id: { not: barcode.id },
        },
        data: { isPrimary: false },
      });

      const updated = await transaction.barcodeRegistry.update({
        where: { id },
        data: { isPrimary: true, isActive: true },
      });

      this.auditService.logAction(
        'SET_PRIMARY',
        'BARCODE',
        id,
        { isPrimary: false },
        { isPrimary: true, isActive: true },
      );

      return updated;
    });
  }

  async deactivateBarcode(id: string) {
    await this.ensureBarcode(id);

    const updated = await this.prisma.barcodeRegistry.update({
      where: { id },
      data: { isActive: false, isPrimary: false },
    });

    this.auditService.logAction(
      'DEACTIVATE',
      'BARCODE',
      id,
      { isActive: true },
      { isActive: false, isPrimary: false },
    );

    return updated;
  }

  async activateBarcode(id: string) {
    const barcode = await this.ensureBarcode(id);
    await this.assertBarcodeMultiplicity({
      ownerType: barcode.ownerType,
      ownerId: barcode.ownerId,
      productId: barcode.productId ?? undefined,
      variantId: barcode.variantId ?? undefined,
      stockItemId: barcode.stockItemId ?? undefined,
      stockItemUnitId: barcode.stockItemUnitId ?? undefined,
      inventoryAssetId: barcode.inventoryAssetId ?? undefined,
      inventoryBatchId: barcode.inventoryBatchId ?? undefined,
      excludeBarcodeId: barcode.id,
    });

    const updated = await this.prisma.barcodeRegistry.update({
      where: { id },
      data: { isActive: true },
    });

    this.auditService.logAction(
      'ACTIVATE',
      'BARCODE',
      id,
      { isActive: false },
      { isActive: true },
    );

    return updated;
  }

  async replaceBarcode(
    id: string,
    input: { code: string; symbology?: string; makePrimary?: boolean },
  ) {
    const existing = await this.ensureBarcode(id);

    await this.deactivateBarcode(id);

    const replaced = await this.registerBarcode({
      code: input.code,
      symbology: input.symbology?.trim() || existing.symbology,
      ownerType: existing.ownerType,
      ownerId: existing.ownerId,
      productId: existing.productId ?? undefined,
      variantId: existing.variantId ?? undefined,
      stockItemId: existing.stockItemId ?? undefined,
      stockItemUnitId: existing.stockItemUnitId ?? undefined,
      inventoryAssetId: existing.inventoryAssetId ?? undefined,
      inventoryBatchId: existing.inventoryBatchId ?? undefined,
      isPrimary: input.makePrimary ?? existing.isPrimary,
    });

    this.auditService.logAction('REPLACE', 'BARCODE', id, existing, replaced);

    return replaced;
  }

  lookupBarcode(code: string) {
    return this.barcodeRegistryService.lookup(code);
  }

  private async assertBarcodeOwner(input: {
    ownerType: BarcodeOwnerType;
    ownerId: string;
    productId?: string;
    variantId?: string;
    stockItemId?: string;
    stockItemUnitId?: string;
    inventoryAssetId?: string;
    inventoryBatchId?: string;
  }) {
    switch (input.ownerType) {
      case BarcodeOwnerType.PRODUCT: {
        const product = await this.prisma.product.findUnique({
          where: { id: input.productId ?? input.ownerId },
          select: { id: true },
        });
        if (!product) {
          throw new NotFoundException('Barcode product owner not found');
        }
        break;
      }
      case BarcodeOwnerType.PRODUCT_VARIANT: {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: input.variantId ?? input.ownerId },
          select: { id: true },
        });
        if (!variant) {
          throw new NotFoundException('Barcode variant owner not found');
        }
        break;
      }
      case BarcodeOwnerType.STOCK_ITEM: {
        await this.stockItemsService.getById(input.stockItemId ?? input.ownerId);
        break;
      }
      case BarcodeOwnerType.STOCK_ITEM_UNIT: {
        const stockItemUnit = await this.prisma.stockItemUnit.findUnique({
          where: { id: input.stockItemUnitId ?? input.ownerId },
          select: { id: true },
        });
        if (!stockItemUnit) {
          throw new NotFoundException('Barcode stock item unit owner not found');
        }
        break;
      }
      case BarcodeOwnerType.INVENTORY_ASSET: {
        const asset = await this.prisma.inventoryAsset.findUnique({
          where: { id: input.inventoryAssetId ?? input.ownerId },
          select: { id: true },
        });
        if (!asset) {
          throw new NotFoundException('Barcode inventory asset owner not found');
        }
        break;
      }
      case BarcodeOwnerType.INVENTORY_BATCH: {
        const batch = await this.prisma.inventoryBatch.findUnique({
          where: { id: input.inventoryBatchId ?? input.ownerId },
          select: { id: true },
        });
        if (!batch) {
          throw new NotFoundException('Barcode inventory batch owner not found');
        }
        break;
      }
      default:
        throw new BadRequestException('Unsupported barcode owner type');
    }
  }

  private async assertBarcodeMultiplicity(input: {
    ownerType: BarcodeOwnerType;
    ownerId: string;
    productId?: string;
    variantId?: string;
    stockItemId?: string;
    stockItemUnitId?: string;
    inventoryAssetId?: string;
    inventoryBatchId?: string;
    excludeBarcodeId?: string;
  }) {
    const stockItemId = await this.resolveBarcodeStockItemId(input);

    if (!stockItemId) {
      return;
    }

    const configuration =
      await this.stockItemConfigurationService.getEffectiveConfiguration(
        stockItemId,
      );

    if (configuration.allowMultipleBarcodes) {
      return;
    }

    const existingActiveBarcode = await this.prisma.barcodeRegistry.findFirst({
      where: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        isActive: true,
        id: input.excludeBarcodeId
          ? { not: input.excludeBarcodeId }
          : undefined,
      },
      select: { id: true },
    });

    if (existingActiveBarcode) {
      throw new ConflictException(
        'Multiple active barcodes are disabled for the resolved stock item',
      );
    }
  }

  private async resolveBarcodeStockItemId(input: {
    ownerType: BarcodeOwnerType;
    stockItemId?: string;
    stockItemUnitId?: string;
  }) {
    if (input.ownerType === BarcodeOwnerType.STOCK_ITEM) {
      return input.stockItemId ?? null;
    }

    if (input.ownerType !== BarcodeOwnerType.STOCK_ITEM_UNIT) {
      return null;
    }

    if (!input.stockItemUnitId) {
      return null;
    }

    const stockItemUnit = await this.prisma.stockItemUnit.findUnique({
      where: { id: input.stockItemUnitId },
      select: { stockItemId: true },
    });

    return stockItemUnit?.stockItemId ?? null;
  }

  private async ensureIdentifierType(id: string) {
    const type = await this.prisma.inventoryIdentifierType.findUnique({
      where: { id },
    });

    if (!type) {
      throw new NotFoundException('Identifier type not found');
    }

    return type;
  }

  private async ensureBarcode(id: string) {
    const barcode = await this.prisma.barcodeRegistry.findUnique({
      where: { id },
    });

    if (!barcode) {
      throw new NotFoundException('Barcode not found');
    }

    return barcode;
  }

  private normalizeCode(code: string) {
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '_');

    if (!normalized) {
      throw new BadRequestException('Code is required');
    }

    return normalized;
  }

  private handleUniqueConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }

    throw error;
  }
}
