import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import {
  InventoryAssetStatus,
  InventoryMovementType,
  InventoryReferenceType,
  InventoryTransformationLineDirection,
  InventoryTransformationType,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  createPaginationMeta,
  normalizePagination,
} from '../shared/helpers/pagination.helper';
import { InventoryService } from './inventory.service';
import {
  AssetListQueryDto,
  AssetSearchQueryDto,
  BarcodeListQueryDto,
  BatchListQueryDto,
  ConversionListQueryDto,
  CreateTransformationDto,
  InventoryReportQueryDto,
  MovementListQueryDto,
  SortOrder,
  StockItemListQueryDto,
  TransformationListQueryDto,
  UnitListQueryDto,
  UpdateAssetDto,
  UpdateBarcodeDto,
} from './inventory-read.dto';

@Injectable()
export class InventoryReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  async listStockItems(query: StockItemListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.StockItemWhereInput = {
      productId: query.productId,
      variantId: query.variantId,
      isActive: query.isActive,
      OR: query.q
        ? [
            { name: { contains: query.q } },
            { sku: { contains: query.q } },
            { product: { name: { contains: query.q } } },
            { variant: { name: { contains: query.q } } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.stockItem.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              isStockTracked: true,
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
              isActive: true,
            },
          },
          baseUnit: true,
          inventoryItem: true,
          configuration: true,
        },
        orderBy: [
          { product: { name: query.sortOrder ?? 'asc' } },
          { name: query.sortOrder ?? 'asc' },
        ],
        skip,
        take,
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getStockItem(id: string) {
    const stockItem = await this.prisma.stockItem.findUnique({
      where: { id },
      include: {
        product: true,
        variant: true,
        baseUnit: true,
        inventoryItem: true,
        configuration: true,
        units: {
          include: {
            unit: true,
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
        identifierRules: {
          include: {
            identifierType: true,
          },
          orderBy: [{ isRequired: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!stockItem) {
      throw new NotFoundException('Stock item not found');
    }

    return stockItem;
  }

  async getStockItemSummary(id: string) {
    const stockItem = await this.getStockItem(id);
    const summary = await this.inventoryService.getAvailability({
      productId: stockItem.productId,
      stockItemId: stockItem.id,
    });

    return {
      ...stockItem,
      summary,
    };
  }

  async listStockItemMovements(id: string, query: MovementListQueryDto) {
    await this.getStockItem(id);
    return this.listMovements({
      ...query,
      stockItemId: id,
    });
  }

  async listStockItemBatches(id: string, query: BatchListQueryDto) {
    await this.getStockItem(id);
    return this.listBatches({
      ...query,
      stockItemId: id,
    });
  }

  async listStockItemAssets(id: string, query: AssetListQueryDto) {
    await this.getStockItem(id);
    return this.listAssets({
      ...query,
      stockItemId: id,
    });
  }

  async listStockItemReservations(id: string, query: MovementListQueryDto) {
    await this.getStockItem(id);
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.InventoryReservationWhereInput = {
      stockItemId: id,
      createdAt: this.dateRange(query.from, query.to),
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryReservation.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          unit: true,
        },
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip,
        take,
      }),
      this.prisma.inventoryReservation.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async listMovements(
    query: MovementListQueryDto & {
      stockItemId?: string;
      productId?: string;
      batchId?: string;
    },
  ) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.InventoryMovementWhereInput = {
      productId: query.productId,
      stockItemId: query.stockItemId,
      referenceType: query.referenceType,
      createdAt: this.dateRange(query.from, query.to),
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          unit: true,
        },
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip,
        take,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    const filteredData = query.batchId
      ? data.filter((movement) => {
          const referenceId = movement.referenceId.toUpperCase();
          return referenceId.includes(query.batchId!.toUpperCase());
        })
      : data;

    return {
      data: filteredData,
      pagination: createPaginationMeta(page, limit, query.batchId ? filteredData.length : total),
    };
  }

  async listBatches(query: BatchListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.InventoryBatchWhereInput = {
      productId: query.productId,
      stockItemId: query.stockItemId,
      batchCode: query.batchCode
        ? { contains: query.batchCode }
        : undefined,
      expiryDate:
        query.expiresAfter || query.expiresBefore
          ? {
              gte: query.expiresAfter ? new Date(query.expiresAfter) : undefined,
              lte: query.expiresBefore ? new Date(query.expiresBefore) : undefined,
            }
          : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryBatch.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          assets: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [
          { expiryDate: query.sortOrder ?? 'asc' },
          { createdAt: query.sortOrder ?? 'asc' },
        ],
        skip,
        take,
      }),
      this.prisma.inventoryBatch.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getBatch(id: string) {
    const batch = await this.prisma.inventoryBatch.findUnique({
      where: { id },
      include: {
        product: true,
        stockItem: true,
        assets: {
          include: {
            identifiers: {
              include: {
                identifierType: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Inventory batch not found');
    }

    return batch;
  }

  async listExpiredBatches(query: BatchListQueryDto) {
    return this.listBatches({
      ...query,
      expiresBefore: new Date().toISOString(),
    });
  }

  async listExpiringBatches(query: BatchListQueryDto & { days?: number }) {
    const days = query.days ?? 30;
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    return this.listBatches({
      ...query,
      expiresAfter: now.toISOString(),
      expiresBefore: future.toISOString(),
    });
  }

  async getBatchMovements(id: string, query: MovementListQueryDto) {
    const batch = await this.getBatch(id);
    const history = await this.auditService.listEntityHistory(
      'INVENTORY',
      batch.productId,
      query,
    );

    const normalized = history.data.flatMap((entry) => {
      const after = (entry.after ?? {}) as Record<string, any>;
      const allocations = Array.isArray(after.allocations) ? after.allocations : [];
      const directBatchMatch = after.batchId === batch.id;
      const allocationMatch = allocations.find(
        (allocation: Record<string, unknown>) => allocation.batchId === batch.id,
      );

      if (!directBatchMatch && !allocationMatch) {
        return [];
      }

      return [
        {
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt,
          batchId: batch.id,
          movementId: after.movementId ?? null,
          quantity:
            allocationMatch?.quantity ??
            after.item?.quantityOnHand ??
            null,
          unitCost:
            allocationMatch?.unitCost ??
            null,
          details: {
            before: entry.before,
            after: entry.after,
            metadata: entry.metadata,
          },
        },
      ];
    });

    return {
      data: normalized,
      pagination: history.pagination,
    };
  }

  async listAssets(query: AssetListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.InventoryAssetWhereInput = {
      stockItemId: query.stockItemId,
      batchId: query.batchId,
      status: query.status,
      OR: query.q
        ? [
            { assetTag: { contains: query.q } },
            {
              identifiers: {
                some: {
                  OR: [
                    { value: { contains: query.q } },
                    { normalizedValue: { contains: query.q.toUpperCase() } },
                  ],
                },
              },
            },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryAsset.findMany({
        where,
        include: {
          stockItem: {
            include: {
              product: true,
              variant: true,
            },
          },
          batch: true,
          identifiers: {
            include: {
              identifierType: true,
            },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
          serialRecord: true,
          barcodes: {
            where: { isActive: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
          },
        },
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip,
        take,
      }),
      this.prisma.inventoryAsset.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getAsset(id: string) {
    const asset = await this.prisma.inventoryAsset.findUnique({
      where: { id },
      include: {
        stockItem: {
          include: {
            product: true,
            variant: true,
          },
        },
        batch: true,
        identifiers: {
          include: {
            identifierType: true,
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        serialRecord: true,
        barcodes: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Inventory asset not found');
    }

    return asset;
  }

  async searchAssets(query: AssetSearchQueryDto) {
    return this.listAssets({
      ...query,
      q: query.identifier ?? query.q,
    });
  }

  async getAssetByIdentifier(value: string) {
    const assetIdentifier = await this.prisma.inventoryAssetIdentifier.findFirst({
      where: {
        OR: [
          { value: value.trim() },
          { normalizedValue: value.trim().toUpperCase() },
        ],
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        assetId: true,
      },
    });

    if (!assetIdentifier) {
      throw new NotFoundException('Inventory asset not found');
    }

    return this.getAsset(assetIdentifier.assetId);
  }

  async getAssetHistory(id: string) {
    const asset = await this.getAsset(id);
    const syntheticEvents: Array<{
      type: string;
      at: Date;
      details: Record<string, unknown>;
    }> = [
      {
        type: 'ASSET_CREATED',
        at: asset.createdAt,
        details: {
          status: asset.status,
          batchId: asset.batchId,
          stockItemId: asset.stockItemId,
        },
      },
    ];

    if (asset.serialRecord) {
      syntheticEvents.push({
        type:
          asset.serialRecord.status === 'SOLD'
            ? 'SERIAL_MARKED_SOLD'
            : asset.serialRecord.status === 'AVAILABLE'
              ? 'SERIAL_AVAILABLE'
              : 'SERIAL_RETURNED',
        at: asset.serialRecord.createdAt,
        details: {
          serialNumber: asset.serialRecord.serialNumber,
          referenceId: asset.serialRecord.referenceId,
        },
      });
    }

    const barcodeEvents = asset.barcodes.map((barcode) => ({
      type: barcode.isActive ? 'BARCODE_ACTIVE' : 'BARCODE_INACTIVE',
      at: barcode.updatedAt,
      details: {
        barcodeId: barcode.id,
        code: barcode.code,
        isPrimary: barcode.isPrimary,
      },
    }));

    const auditHistory = await this.auditService.listEntityHistory(
      'INVENTORY_ASSET',
      id,
      { page: 1, limit: 100 },
    );

    const auditEvents = auditHistory.data.map((entry) => ({
      type: entry.action,
      at: entry.createdAt,
      details: {
        before: entry.before,
        after: entry.after,
        metadata: entry.metadata,
      },
    }));

    return [...syntheticEvents, ...barcodeEvents, ...auditEvents].sort(
      (left, right) => left.at.getTime() - right.at.getTime(),
    );
  }

  async updateAsset(id: string, dto: UpdateAssetDto) {
    const asset = await this.getAsset(id);
    const updated = await this.prisma.inventoryAsset.update({
      where: { id },
      data: {
        assetTag:
          dto.assetTag === undefined ? undefined : (dto.assetTag?.trim() || null),
        status: dto.status,
      },
    });

    this.auditService.logUpdate('INVENTORY_ASSET', id, asset, updated);

    return updated;
  }

  async retireAsset(id: string) {
    const asset = await this.getAsset(id);

    if (asset.status === InventoryAssetStatus.SOLD) {
      throw new ConflictException('Sold assets cannot be retired');
    }

    const updated = await this.prisma.inventoryAsset.update({
      where: { id },
      data: {
        status: InventoryAssetStatus.INACTIVE,
      },
    });

    this.auditService.logAction('RETIRE', 'INVENTORY_ASSET', id, asset, updated);

    return updated;
  }

  async reactivateAsset(id: string) {
    const asset = await this.getAsset(id);

    if (asset.status !== InventoryAssetStatus.INACTIVE) {
      throw new ConflictException('Only inactive assets can be reactivated');
    }

    const updated = await this.prisma.inventoryAsset.update({
      where: { id },
      data: {
        status: InventoryAssetStatus.AVAILABLE,
      },
    });

    this.auditService.logAction(
      'REACTIVATE',
      'INVENTORY_ASSET',
      id,
      asset,
      updated,
    );

    return updated;
  }

  async listBarcodes(query: BarcodeListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.BarcodeRegistryWhereInput = {
      ownerType: query.ownerType,
      productId: query.productId,
      stockItemId: query.stockItemId,
      isActive: query.activeOnly ? true : undefined,
      OR: query.q
        ? [
            { code: { contains: query.q } },
            { normalizedCode: { contains: query.q.toUpperCase() } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.barcodeRegistry.findMany({
        where,
        include: {
          product: true,
          variant: true,
          stockItem: true,
          stockItemUnit: {
            include: {
              unit: true,
            },
          },
          inventoryAsset: true,
          inventoryBatch: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: query.sortOrder ?? 'desc' },
        ],
        skip,
        take,
      }),
      this.prisma.barcodeRegistry.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getBarcode(id: string) {
    const barcode = await this.prisma.barcodeRegistry.findUnique({
      where: { id },
      include: {
        product: true,
        variant: true,
        stockItem: true,
        stockItemUnit: {
          include: {
            unit: true,
          },
        },
        inventoryAsset: true,
        inventoryBatch: true,
      },
    });

    if (!barcode) {
      throw new NotFoundException('Barcode not found');
    }

    return barcode;
  }

  getBarcodeHistory(id: string, query?: { page?: number; limit?: number }) {
    return this.auditService.listEntityHistory('BARCODE', id, query);
  }

  async updateBarcode(id: string, dto: UpdateBarcodeDto) {
    const barcode = await this.getBarcode(id);
    const nextNormalizedCode = dto.code?.trim().toUpperCase().replace(/\s+/g, '');

    if (nextNormalizedCode) {
      const existing = await this.prisma.barcodeRegistry.findUnique({
        where: { normalizedCode: nextNormalizedCode },
        select: { id: true },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Barcode already exists');
      }
    }

    if (dto.isPrimary) {
      await this.prisma.barcodeRegistry.updateMany({
        where: {
          ownerType: barcode.ownerType,
          ownerId: barcode.ownerId,
          id: { not: barcode.id },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const updated = await this.prisma.barcodeRegistry.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        normalizedCode: nextNormalizedCode,
        symbology: dto.symbology?.trim().toUpperCase(),
        isPrimary: dto.isPrimary,
      },
    });

    this.auditService.logUpdate('BARCODE', id, barcode, updated);

    return updated;
  }

  async deactivateBarcode(id: string) {
    const barcode = await this.getBarcode(id);
    const updated = await this.prisma.barcodeRegistry.update({
      where: { id },
      data: {
        isActive: false,
        isPrimary: false,
      },
    });

    this.auditService.logAction('DEACTIVATE', 'BARCODE', id, barcode, updated);

    return updated;
  }

  async activateBarcode(id: string) {
    const barcode = await this.getBarcode(id);
    const updated = await this.prisma.barcodeRegistry.update({
      where: { id },
      data: {
        isActive: true,
      },
    });

    this.auditService.logAction('ACTIVATE', 'BARCODE', id, barcode, updated);

    return updated;
  }

  async deleteBarcode(id: string) {
    return this.deactivateBarcode(id);
  }

  async listUnits(query: UnitListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.UnitDefinitionWhereInput = {
      measurementGroupId: query.measurementGroupId,
      OR: query.q
        ? [
            { code: { contains: query.q } },
            { name: { contains: query.q } },
            { symbol: { contains: query.q } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.unitDefinition.findMany({
        where,
        include: {
          measurementGroup: true,
        },
        orderBy: [{ name: query.sortOrder ?? 'asc' }],
        skip,
        take,
      }),
      this.prisma.unitDefinition.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getUnit(id: string) {
    const unit = await this.prisma.unitDefinition.findUnique({
      where: { id },
      include: {
        measurementGroup: true,
        stockItemUnits: {
          include: {
            stockItem: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    return unit;
  }

  getUnitHistory(id: string, query?: { page?: number; limit?: number }) {
    return this.auditService.listEntityHistory('UNIT', id, query);
  }

  async listConversions(query: ConversionListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.StockItemUnitConversionWhereInput = {
      stockItemId: query.stockItemId,
      fromUnitId: query.fromUnitId,
      toUnitId: query.toUnitId,
    };
    const [data, total] = await Promise.all([
      this.prisma.stockItemUnitConversion.findMany({
        where,
        include: {
          stockItem: true,
          fromUnit: true,
          toUnit: true,
        },
        orderBy: [{ createdAt: query.sortOrder ?? 'desc' }],
        skip,
        take,
      }),
      this.prisma.stockItemUnitConversion.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getConversion(id: string) {
    const conversion = await this.prisma.stockItemUnitConversion.findUnique({
      where: { id },
      include: {
        stockItem: true,
        fromUnit: true,
        toUnit: true,
      },
    });

    if (!conversion) {
      throw new NotFoundException('Conversion not found');
    }

    return conversion;
  }

  getConversionHistory(id: string, query?: { page?: number; limit?: number }) {
    return this.auditService.listEntityHistory('STOCK_ITEM_CONVERSION', id, query);
  }

  async createTransformation(input: CreateTransformationDto, createdBy?: string) {
    if (!input.lines.length) {
      throw new BadRequestException('At least one transformation line is required');
    }

    const created = await this.prisma.inventoryTransformation.create({
      data: {
        id: randomUUID(),
        type: input.type,
        referenceId: input.referenceId?.trim() || null,
        notes: this.cleanTransformationNotes(input.notes),
        createdBy: createdBy ?? null,
        lines: {
          create: input.lines.map((line) => ({
            id: randomUUID(),
            stockItemId: line.stockItemId,
            unitId: line.unitId ?? null,
            direction: line.direction,
            quantity: new Prisma.Decimal(line.quantity),
            baseQuantity: null,
            unitCost:
              line.unitCost === undefined
                ? null
                : new Prisma.Decimal(line.unitCost),
          })),
        },
      },
      include: this.transformationInclude(),
    });

    this.auditService.logCreate('INVENTORY_TRANSFORMATION', created.id, created);

    return created;
  }

  async listTransformations(query: TransformationListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.InventoryTransformationWhereInput = {
      type: query.type,
      OR: query.q
        ? [
            { referenceId: { contains: query.q } },
            { notes: { contains: query.q } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryTransformation.findMany({
        where,
        include: this.transformationInclude(),
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.inventoryTransformation.count({ where }),
    ]);

    return {
      data: await Promise.all(data.map((item) => this.enrichTransformation(item))),
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getTransformation(id: string) {
    const transformation = await this.prisma.inventoryTransformation.findUnique({
      where: { id },
      include: this.transformationInclude(),
    });

    if (!transformation) {
      throw new NotFoundException('Transformation not found');
    }

    return this.enrichTransformation(transformation);
  }

  async executeTransformation(id: string) {
    const previousState = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM inventory_transformations
        WHERE id = ${id}
        FOR UPDATE
      `;

      const transformation = await transaction.inventoryTransformation.findUnique({
        where: { id },
        include: this.transformationInclude(),
      });

      if (!transformation) {
        throw new NotFoundException('Transformation not found');
      }

      if (this.isTransformationCancelled(transformation.notes)) {
        throw new ConflictException('Cancelled transformations cannot be executed');
      }

      if (this.isTransformationExecuted(transformation.notes)) {
        throw new ConflictException('Transformation has already been executed');
      }

      const existingMovements = await transaction.inventoryMovement.findMany({
        where: {
          referenceType: InventoryReferenceType.ADJUSTMENT,
          referenceId: transformation.id,
        },
        select: { id: true },
      });

      if (existingMovements.length > 0) {
        throw new ConflictException('Transformation has already been executed');
      }

      for (const line of transformation.lines) {
        const stockItem = line.stockItem;

        if (!stockItem) {
          throw new NotFoundException('Transformation stock item not found');
        }

        const result =
          line.direction === InventoryTransformationLineDirection.OUT
            ? await this.inventoryService.stockOutInTransaction(
                {
                  productId: stockItem.productId,
                  variantId: stockItem.variantId,
                  stockItemId: stockItem.id,
                  unitId: line.unitId,
                  quantity: line.quantity,
                  referenceType: InventoryReferenceType.ADJUSTMENT,
                  referenceId: transformation.id,
                  eventKey: `inventory-transformation:${transformation.id}:${line.id}:out`,
                },
                transaction,
              )
            : await this.inventoryService.stockInInTransaction(
                {
                  productId: stockItem.productId,
                  variantId: stockItem.variantId,
                  stockItemId: stockItem.id,
                  unitId: line.unitId,
                  batchCode: `TRANSFORMATION-${transformation.id}`,
                  quantity: line.quantity,
                  unitCost: line.unitCost ?? 0,
                  referenceType: InventoryReferenceType.ADJUSTMENT,
                  referenceId: transformation.id,
                  eventKey: `inventory-transformation:${transformation.id}:${line.id}:in`,
                },
                transaction,
              );

        if (!('alreadyProcessed' in result && result.alreadyProcessed)) {
          await transaction.inventoryTransformationLine.update({
            where: { id: line.id },
            data: {
              baseQuantity: result.movement.baseQuantity,
            },
          });
        }
      }

      await transaction.inventoryTransformation.update({
        where: { id },
        data: {
          notes: this.markTransformationState(transformation.notes, 'EXECUTED'),
        },
      });

      return { notes: transformation.notes };
    });

    this.auditService.logAction(
      'EXECUTE',
      'INVENTORY_TRANSFORMATION',
      id,
      previousState,
      { notes: this.markTransformationState(previousState.notes, 'EXECUTED') },
    );

    return this.getTransformation(id);
  }

  async cancelTransformation(id: string) {
    const transformation = await this.prisma.inventoryTransformation.findUnique({
      where: { id },
      select: { id: true, notes: true },
    });

    if (!transformation) {
      throw new NotFoundException('Transformation not found');
    }

    const executedMovement = await this.prisma.inventoryMovement.findFirst({
      where: {
        referenceType: InventoryReferenceType.ADJUSTMENT,
        referenceId: id,
      },
      select: { id: true },
    });

    if (executedMovement) {
      throw new ConflictException('Executed transformations cannot be cancelled');
    }

    const nextNotes = this.isTransformationCancelled(transformation.notes)
      ? transformation.notes
      : this.markTransformationState(transformation.notes, 'CANCELLED');

    await this.prisma.inventoryTransformation.update({
      where: { id },
      data: {
        notes: nextNotes,
      },
    });

    this.auditService.logAction(
      'CANCEL',
      'INVENTORY_TRANSFORMATION',
      id,
      { notes: transformation.notes },
      { notes: nextNotes },
    );

    return this.getTransformation(id);
  }

  async inventorySummaryReport(query: InventoryReportQueryDto) {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where = {
      productId: query.productId,
      id: query.stockItemId,
    };
    const [stockItems, total] = await Promise.all([
      this.prisma.stockItem.findMany({
        where,
        include: {
          product: true,
          variant: true,
          inventoryItem: true,
          inventoryBatches: true,
        },
        orderBy: [{ createdAt: query.sortOrder ?? 'desc' }],
        skip,
        take,
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    return {
      data: stockItems.map((stockItem) => ({
        stockItemId: stockItem.id,
        productId: stockItem.productId,
        productName: stockItem.product.name,
        variantId: stockItem.variantId,
        variantName: stockItem.variant?.name ?? null,
        quantityOnHand: stockItem.inventoryItem?.quantityOnHand.toString() ?? '0',
        reservedQuantity: stockItem.inventoryItem?.reservedQuantity.toString() ?? '0',
        availableQuantity: stockItem.inventoryItem
          ? stockItem.inventoryItem.quantityOnHand
              .minus(stockItem.inventoryItem.reservedQuantity)
              .toString()
          : '0',
        batchCount: stockItem.inventoryBatches.length,
      })),
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async inventoryMovementsReport(query: InventoryReportQueryDto) {
    const result = await this.listMovements({
      page: query.page,
      limit: query.limit,
      productId: query.productId,
      stockItemId: query.stockItemId,
      from: query.from,
      to: query.to,
      sortOrder: query.sortOrder ?? SortOrder.DESC,
    });

    return result;
  }

  async inventoryValuationReport(query: InventoryReportQueryDto) {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where = {
      productId: query.productId,
      stockItemId: query.stockItemId,
    };
    const [batches, total] = await Promise.all([
      this.prisma.inventoryBatch.findMany({
        where,
        include: {
          product: true,
          stockItem: true,
        },
        orderBy: [{ createdAt: query.sortOrder ?? 'desc' }],
        skip,
        take,
      }),
      this.prisma.inventoryBatch.count({ where }),
    ]);

    return {
      data: batches.map((batch) => ({
        batchId: batch.id,
        stockItemId: batch.stockItemId,
        productId: batch.productId,
        productName: batch.product.name,
        batchCode: batch.batchCode,
        quantityRemaining: batch.quantityRemaining.toString(),
        unitCost: batch.unitCost.toString(),
        inventoryValue: batch.quantityRemaining.mul(batch.unitCost).toString(),
      })),
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async expiringStockReport(query: InventoryReportQueryDto) {
    return this.listExpiringBatches({
      page: query.page,
      limit: query.limit,
      productId: query.productId,
      stockItemId: query.stockItemId,
      days: query.days,
    });
  }

  async assetsReport(query: InventoryReportQueryDto) {
    return this.listAssets({
      page: query.page,
      limit: query.limit,
      stockItemId: query.stockItemId,
      sortOrder: SortOrder.DESC,
    });
  }

  async purchasingReport(query: InventoryReportQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.GoodsReceiptWhereInput = {
      receivedAt: this.dateRange(query.from, query.to),
      items: query.productId || query.stockItemId
        ? {
            some: {
              productId: query.productId,
              stockItemId: query.stockItemId,
            },
          }
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({
        where,
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
            },
          },
          items: {
            include: {
              product: true,
              stockItem: true,
              unit: true,
            },
          },
        },
        orderBy: { receivedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async posReport(query: InventoryReportQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where: Prisma.POSTransactionWhereInput = {
      createdAt: this.dateRange(query.from, query.to),
      order: query.productId || query.stockItemId
        ? {
            items: {
              some: {
                productId: query.productId,
                stockItemId: query.stockItemId,
              },
            },
          }
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.pOSTransaction.findMany({
        where,
        include: {
          session: true,
          order: {
            include: {
              items: true,
              payments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.pOSTransaction.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  private transformationInclude() {
    return {
      lines: {
        include: {
          stockItem: {
            include: {
              product: true,
              variant: true,
            },
          },
          unit: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    } satisfies Prisma.InventoryTransformationInclude;
  }

  private async enrichTransformation<
    T extends {
      id: string;
      notes: string | null;
      lines: Array<{
        direction: InventoryTransformationLineDirection;
        quantity: Prisma.Decimal;
        unitCost: Prisma.Decimal | null;
      }>;
    },
  >(transformation: T) {
    return {
      ...transformation,
      status: this.isTransformationCancelled(transformation.notes)
        ? 'CANCELLED'
        : this.isTransformationExecuted(transformation.notes)
          ? 'EXECUTED'
          : 'DRAFT',
    };
  }

  private isTransformationCancelled(notes?: string | null) {
    return notes?.trim().startsWith('[CANCELLED]') ?? false;
  }

  getTransformationHistory(id: string, query?: { page?: number; limit?: number }) {
    return this.auditService.listEntityHistory('INVENTORY_TRANSFORMATION', id, query);
  }

  private isTransformationExecuted(notes?: string | null) {
    return notes?.trim().startsWith('[EXECUTED]') ?? false;
  }

  private cleanTransformationNotes(notes?: string | null) {
    return notes
      ?.replace(/^\[(EXECUTED|CANCELLED)\]\s*/g, '')
      .trim() || null;
  }

  private markTransformationState(
    notes: string | null | undefined,
    state: 'EXECUTED' | 'CANCELLED',
  ) {
    const cleaned = this.cleanTransformationNotes(notes);
    return `[${state}]${cleaned ? ` ${cleaned}` : ''}`;
  }

  private dateRange(from?: string, to?: string) {
    if (!from && !to) {
      return undefined;
    }

    return {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    };
  }
}
