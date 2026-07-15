import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PurchaseOrderStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  createPaginationMeta,
  normalizePagination,
} from '../shared/helpers/pagination.helper';

@Injectable()
export class PurchaseReadService {
  constructor(private readonly prisma: PrismaService) {}

  async listPurchaseOrders(query: {
    page?: number;
    limit?: number;
    supplierId?: string;
    status?: PurchaseOrderStatus;
    q?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where: Prisma.PurchaseOrderWhereInput = {
      supplierId: query.supplierId,
      status: query.status,
      OR: query.q
        ? [
            { id: { contains: query.q } },
            { supplier: { name: { contains: query.q } } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
              stockItem: true,
              unit: true,
            },
          },
          receipts: {
            select: {
              id: true,
              receivedAt: true,
            },
          },
        },
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip,
        take,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async getPurchaseOrder(id: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            stockItem: true,
            unit: true,
          },
        },
        receipts: {
          include: {
            items: true,
          },
        },
        invoices: true,
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    return purchaseOrder;
  }

  async listGoodsReceipts(query: {
    page?: number;
    limit?: number;
    purchaseOrderId?: string;
    supplierId?: string;
    q?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where: Prisma.GoodsReceiptWhereInput = {
      purchaseOrderId: query.purchaseOrderId,
      purchaseOrder: query.supplierId
        ? {
            supplierId: query.supplierId,
          }
        : undefined,
      OR: query.q
        ? [
            { id: { contains: query.q } },
            { purchaseOrderId: { contains: query.q } },
          ]
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
          receiver: true,
          items: {
            include: {
              product: true,
              stockItem: true,
              unit: true,
            },
          },
        },
        orderBy: { receivedAt: query.sortOrder ?? 'desc' },
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

  async getGoodsReceipt(id: string) {
    const receipt = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
          },
        },
        receiver: true,
        items: {
          include: {
            product: true,
            stockItem: true,
            unit: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Goods receipt not found');
    }

    return receipt;
  }

  async supplierPurchaseHistory(
    supplierId: string,
    query: { page?: number; limit?: number; sortOrder?: 'asc' | 'desc' },
  ) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where: Prisma.PurchaseOrderWhereInput = { supplierId };
    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
              stockItem: true,
              unit: true,
            },
          },
          receipts: {
            include: {
              items: true,
            },
          },
        },
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip,
        take,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }
}
