import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PurchaseOrderStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class GoodsReceiptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(callback, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  create(data: Prisma.GoodsReceiptCreateInput, transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.prisma).goodsReceipt.create({
      data,
      include: { items: true },
    });
  }

  findMany() {
    return this.prisma.goodsReceipt.findMany({
      include: { items: true },
      orderBy: { receivedAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  findByRequestKey(requestKey: string, transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.prisma).goodsReceipt.findUnique({
      where: { requestKey },
      include: { items: true },
    });
  }

  async lockPurchaseOrderWithItems(
    id: string,
    transaction: Prisma.TransactionClient,
  ) {
    await transaction.$queryRaw`
      SELECT id
      FROM purchase_orders
      WHERE id = ${id}
      FOR UPDATE
    `;

    await transaction.$queryRaw`
      SELECT id
      FROM purchase_order_items
      WHERE purchase_order_id = ${id}
      FOR UPDATE
    `;

    return transaction.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });
  }

  updatePurchaseOrderStatus(
    id: string,
    status: PurchaseOrderStatus,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prisma).purchaseOrder.update({
      where: { id },
      data: { status },
    });
  }

  updateReceivedQuantity(
    id: string,
    quantity: Prisma.Decimal,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prisma).purchaseOrderItem.update({
      where: { id },
      data: {
        receivedQuantity: {
          increment: quantity,
        },
      },
    });
  }
}
