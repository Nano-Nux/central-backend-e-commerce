import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { normalizePagination, createPaginationMeta } from '../shared/helpers/pagination.helper';

@Injectable()
export class VariantReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listProductVariants(
    productId: string,
    query: {
      page?: number;
      limit?: number;
      q?: string;
      isActive?: boolean;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where = {
      productId,
      deletedAt: null,
      isActive: query.isActive,
      OR: query.q
        ? [
            { name: { contains: query.q } },
            { sku: { contains: query.q } },
            { barcode: { contains: query.q } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        include: {
          stockItems: {
            include: {
              inventoryItem: true,
            },
          },
        },
        orderBy: [{ createdAt: query.sortOrder ?? 'asc' }],
        skip,
        take,
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getVariant(id: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        product: true,
        prices: true,
        stockItems: {
          include: {
            inventoryItem: true,
            units: {
              include: {
                unit: true,
              },
            },
            identifierRules: {
              include: {
                identifierType: true,
              },
            },
            configuration: true,
          },
        },
        barcodes: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    return variant;
  }

  async getVariantInventory(id: string) {
    const variant = await this.getVariant(id);
    const stockItem = variant.stockItems[0] ?? null;

    return {
      variant,
      stockItem,
      inventory: stockItem?.inventoryItem ?? null,
    };
  }

  async getVariantAssets(
    id: string,
    query: {
      page?: number;
      limit?: number;
      status?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const variant = await this.getVariant(id);
    const stockItemIds = variant.stockItems.map((stockItem) => stockItem.id);
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where = {
      stockItemId: {
        in: stockItemIds.length ? stockItemIds : ['__missing__'],
      },
      status: query.status as any,
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryAsset.findMany({
        where,
        include: {
          batch: true,
          identifiers: {
            include: {
              identifierType: true,
            },
          },
        },
        orderBy: [{ createdAt: query.sortOrder ?? 'desc' }],
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

  async getVariantBatches(
    id: string,
    query: { page?: number; limit?: number; sortOrder?: 'asc' | 'desc' },
  ) {
    const variant = await this.getVariant(id);
    const stockItemIds = variant.stockItems.map((stockItem) => stockItem.id);
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where = {
      stockItemId: {
        in: stockItemIds.length ? stockItemIds : ['__missing__'],
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryBatch.findMany({
        where,
        include: {
          stockItem: true,
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

  getVariantHistory(id: string, query?: { page?: number; limit?: number }) {
    return this.auditService.listEntityHistory('PRODUCT_VARIANT', id, query);
  }
}
