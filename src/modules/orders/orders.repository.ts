import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

import {
  InventorySerialStatus,
  OrderSource,
  OrderStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const orderListSelect = {
  id: true,
  customerId: true,
  type: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  status: true,
  source: true,
  subtotal: true,
  discount: true,
  tax: true,
  total: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
} as const;

const orderDetailSelect = {
  ...orderListSelect,
  items: {
    select: {
      id: true,
      productId: true,
      stockItemId: true,
      variantId: true,
      unitId: true,
      assetIds: true,
      serialNumbers: true,
      quantity: true,
      baseQuantity: true,
      unitPrice: true,
      totalPrice: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          type: true,
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
    },
  },
  payments: {
    select: {
      id: true,
      method: true,
      amount: true,
      status: true,
      reference: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} as const;

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(callback, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  create(data: Prisma.OrderCreateInput, transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.prisma).order.create({
      data,
      select: orderDetailSelect,
    });
  }

  findMany(params: {
    where: Prisma.OrderWhereInput;
    skip: number;
    take: number;
  }) {
    return this.prisma.order.findMany({
      where: params.where,
      skip: params.skip,
      take: params.take,
      select: orderListSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  count(where: Prisma.OrderWhereInput) {
    return this.prisma.order.count({ where });
  }

  findById(id: string, transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.prisma).order.findUnique({
      where: { id },
      select: orderDetailSelect,
    });
  }

  findByRequestKey(requestKey: string, transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.prisma).order.findUnique({
      where: { requestKey },
      select: orderDetailSelect,
    });
  }

  updateStatus(
    id: string,
    status: OrderStatus,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prisma).order.update({
      where: { id },
      data: { status },
      select: orderDetailSelect,
    });
  }

  updateDetails(
    id: string,
    data: Prisma.OrderUncheckedUpdateInput,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prisma).order.update({
      where: { id },
      data,
      select: orderDetailSelect,
    });
  }

  async findProductForOrderItem(productId: string, variantId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        isActive: true,
        isStockTracked: true,
        isSerialized: true,
      },
    });

    if (!product || !variantId) {
      return product
        ? {
            ...product,
            variants: [],
          }
        : product;
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        isActive: true,
      },
      select: { id: true },
    });

    return {
      ...product,
      variants: variant ? [variant] : [],
    };
  }

  countAvailableSerialNumbers(
    productId: string,
    serialNumbers: string[],
    stockItemId?: string | null,
  ) {
    if (!serialNumbers.length) {
      return Promise.resolve(0);
    }

    return this.prisma.inventorySerial.count({
      where: {
        productId,
        ...(stockItemId
          ? {
              OR: [{ stockItemId }, { stockItemId: null }],
            }
          : {}),
        status: InventorySerialStatus.AVAILABLE,
        serialNumber: {
          in: serialNumbers,
        },
      },
    });
  }

  buildWhere(params: {
    customerId?: string;
    status?: OrderStatus;
    source?: OrderSource;
  }): Prisma.OrderWhereInput {
    return {
      customerId: params.customerId,
      status: params.status,
      source: params.source,
    };
  }
}
