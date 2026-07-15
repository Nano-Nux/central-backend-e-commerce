import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PurchaseOrderStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const purchaseOrderDetail = {
  id: true,
  supplierId: true,
  status: true,
  subtotal: true,
  tax: true,
  total: true,
  createdAt: true,
  updatedAt: true,
  items: true,
} as const;

type PurchaseOrderTransaction = Prisma.TransactionClient;

@Injectable()
export class PurchaseOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.PurchaseOrderCreateInput,
    transaction?: PurchaseOrderTransaction,
  ) {
    return (transaction ?? this.prisma).purchaseOrder.create({
      data,
      select: purchaseOrderDetail,
    });
  }

  findMany() {
    return this.prisma.purchaseOrder.findMany({
      select: purchaseOrderDetail,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: purchaseOrderDetail,
    });
  }

  updateStatus(
    id: string,
    status: PurchaseOrderStatus,
    transaction?: PurchaseOrderTransaction,
  ) {
    return (transaction ?? this.prisma).purchaseOrder.update({
      where: { id },
      data: { status },
      select: purchaseOrderDetail,
    });
  }

  findProductById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
  }

  updateReceivedQuantity(
    itemId: string,
    receivedQuantity: Prisma.Decimal,
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.purchaseOrderItem.update({
      where: { id: itemId },
      data: {
        receivedQuantity: {
          increment: receivedQuantity,
        },
      },
    });
  }

  transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(callback);
  }
}
