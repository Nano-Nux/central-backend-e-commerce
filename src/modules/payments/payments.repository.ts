import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { OrderStatus, PaymentStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const paymentSelect = {
  id: true,
  orderId: true,
  method: true,
  amount: true,
  status: true,
  reference: true,
  idempotencyKey: true,
  refundOfPaymentId: true,
  merchantPaymentConfigurationId: true,
  verificationContextJson: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PaymentTransaction = Prisma.TransactionClient;

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(callback: (transaction: PaymentTransaction) => Promise<T>) {
    return this.prisma.$transaction(callback, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  create(
    data: Prisma.PaymentUncheckedCreateInput,
    transaction?: PaymentTransaction,
  ) {
    return this.client(transaction).payment.create({
      data,
      select: paymentSelect,
    });
  }

  findMany(params: { skip: number; take: number }) {
    return this.prisma.payment.findMany({
      skip: params.skip,
      take: params.take,
      select: paymentSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  count() {
    return this.prisma.payment.count();
  }

  findById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      select: paymentSelect,
    });
  }

  findByIdempotencyKey(
    idempotencyKey: string,
    transaction?: PaymentTransaction,
  ) {
    return this.client(transaction).payment.findUnique({
      where: { idempotencyKey },
      select: paymentSelect,
    });
  }

  findByReference(reference: string, transaction?: PaymentTransaction) {
    return this.client(transaction).payment.findUnique({
      where: { reference },
      select: paymentSelect,
    });
  }

  findOrderSummary(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
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
                isStockTracked: true,
                isSerialized: true,
              },
            },
          },
        },
      } as any,
    });
  }

  async lockOrderSummary(orderId: string, transaction: PaymentTransaction) {
    await transaction.$queryRaw`
      SELECT id
      FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `;

    return transaction.order.findUnique({
      where: { id: orderId },
      select: {
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
                isStockTracked: true,
                isSerialized: true,
              },
            },
          },
        },
      } as any,
    });
  }

  async lockPaymentById(paymentId: string, transaction: PaymentTransaction) {
    await transaction.$queryRaw`
      SELECT id
      FROM payments
      WHERE id = ${paymentId}
      FOR UPDATE
    `;

    return transaction.payment.findUnique({
      where: { id: paymentId },
      select: paymentSelect,
    });
  }

  updateStatusIfCurrent(
    paymentId: string,
    currentStatus: PaymentStatus,
    nextStatus: PaymentStatus,
    transaction: PaymentTransaction,
  ) {
    return transaction.payment.updateMany({
      where: {
        id: paymentId,
        status: currentStatus,
      },
      data: {
        status: nextStatus,
      },
    });
  }

  updateOrderStatusIfCurrent(
    orderId: string,
    currentStatuses: OrderStatus[],
    nextStatus: OrderStatus,
    transaction: PaymentTransaction,
  ) {
    return transaction.order.updateMany({
      where: {
        id: orderId,
        status: {
          in: currentStatuses,
        },
      },
      data: {
        status: nextStatus,
      },
    });
  }

  findRefundForPayment(paymentId: string, transaction?: PaymentTransaction) {
    return this.client(transaction).payment.findFirst({
      where: {
        refundOfPaymentId: paymentId,
      },
      select: paymentSelect,
    });
  }

  async sumSuccessfulPayments(
    orderId: string,
    transaction?: PaymentTransaction,
  ) {
    const result = await this.client(transaction).payment.aggregate({
      where: {
        orderId,
        status: PaymentStatus.SUCCESS,
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  private client(transaction?: PaymentTransaction) {
    return transaction ?? this.prisma;
  }
}
