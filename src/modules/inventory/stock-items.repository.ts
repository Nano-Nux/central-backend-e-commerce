import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class StockItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.stockItem.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            isActive: true,
            isStockTracked: true,
            isSerialized: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        baseUnit: true,
      },
    });
  }

  findByProductAndVariant(productId: string, variantId?: string | null) {
    return this.prisma.stockItem.findFirst({
      where: {
        productId,
        variantId: variantId ?? null,
      },
      include: {
        baseUnit: true,
      },
    });
  }

  create(data: Prisma.StockItemUncheckedCreateInput) {
    return this.prisma.stockItem.create({
      data,
    });
  }

  update(id: string, data: Prisma.StockItemUncheckedUpdateInput) {
    return this.prisma.stockItem.update({
      where: { id },
      data,
    });
  }

  list(params?: { productId?: string; variantId?: string; isActive?: boolean }) {
    return this.prisma.stockItem.findMany({
      where: {
        productId: params?.productId,
        variantId: params?.variantId,
        isActive: params?.isActive,
      },
      include: {
        baseUnit: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: [{ productId: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
