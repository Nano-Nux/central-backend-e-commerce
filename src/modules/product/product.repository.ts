import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const productListSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  sku: true,
  barcode: true,
  type: true,
  isActive: true,
  isFeatured: true,
  isStockTracked: true,
  isSerialized: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  categoryAssignments: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
          label: true,
          slug: true,
          path: true,
        },
      },
    },
  },
} as const;

const productDetailSelect = {
  ...productListSelect,
  description: true,
  inventoryItem: {
    select: {
      quantityOnHand: true,
      reservedQuantity: true,
    },
  },
  variants: {
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      isActive: true,
      attributes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  images: {
    select: {
      id: true,
      url: true,
      position: true,
    },
    orderBy: {
      position: 'asc',
    },
  },
  attributes: {
    select: {
      id: true,
      key: true,
      value: true,
    },
  },
  prices: {
    select: {
      id: true,
      variantId: true,
      costPrice: true,
      sellingPrice: true,
      wholesalePrice: true,
      memberPrice: true,
      promotionPrice: true,
      promotionStartAt: true,
      promotionEndAt: true,
    },
  },
} as const;

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ProductCreateInput) {
    return this.prisma.product.create({
      data,
      select: productDetailSelect,
    });
  }

  findMany(params: {
    where: Prisma.ProductWhereInput;
    skip: number;
    take: number;
  }) {
    return this.prisma.product.findMany({
      where: params.where,
      skip: params.skip,
      take: params.take,
      select: productListSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  count(where: Prisma.ProductWhereInput) {
    return this.prisma.product.count({ where });
  }

  findById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      select: productDetailSelect,
    });
  }

  update(id: string, data: Prisma.ProductUpdateInput) {
    return this.prisma.product.update({
      where: { id },
      data,
      select: productDetailSelect,
    });
  }
}
