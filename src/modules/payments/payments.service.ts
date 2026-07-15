import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { OrderStatus, PaymentStatus } from '../../../generated/prisma/enums';
import { SystemEvents } from '../../common/constants/event.constants';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import {
  PaymentRecordedEventPayload,
  PaymentRefundedEventPayload,
} from '../../infrastructure/event-bus/events/payment.events';
import {
  OrderCancelledEvent,
  OrderPaidEvent,
  OrderRefundedEvent,
} from '../../infrastructure/event-bus/events/order-created.event';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { RecordPaymentDto } from '../shared/dto/record-payment.dto';
import {
  createPaginationMeta,
  normalizePagination,
} from '../shared/helpers/pagination.helper';
import { PaymentTransaction, PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async recordPayment(
    dto: RecordPaymentDto,
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const desiredStatus = dto.status ?? PaymentStatus.SUCCESS;
    const amount = new Prisma.Decimal(dto.amount);
    let emitPaymentRecorded = false;
    let emitPaymentSucceeded = false;
    let emitPaymentFailed = false;
    let emitOrderPaid = false;
    let emitOrderCancelled = false;
    let paymentPayload: PaymentRecordedEventPayload | null = null;

    let payment: Awaited<
      ReturnType<PaymentsRepository['findById']>
    > extends infer T
      ? Exclude<T, null>
      : never;

    try {
      const persist = async (transactionClient: Prisma.TransactionClient) => {
          let existingPayment = await this.findExistingPaymentForReplay(
            dto,
            transactionClient,
          );

          if (existingPayment) {
            this.ensureReplayCompatibility(existingPayment, dto, amount);

            emitPaymentRecorded = true;
            emitPaymentSucceeded =
              existingPayment.status === PaymentStatus.SUCCESS;
            emitPaymentFailed = existingPayment.status === PaymentStatus.FAILED;
            emitOrderPaid = existingPayment.status === PaymentStatus.SUCCESS;
            emitOrderCancelled =
              existingPayment.status === PaymentStatus.FAILED;
          }

          const order = (await this.paymentsRepository.lockOrderSummary(
            dto.orderId,
            transactionClient,
          )) as any;

          if (!order) {
            throw new NotFoundException('Order not found');
          }

          if (
            order.status === OrderStatus.CANCELLED ||
            order.status === OrderStatus.REFUNDED
          ) {
            throw new BadRequestException(
              'Payments are not allowed for this order',
            );
          }

          let paymentRecord = existingPayment;

          if (
            desiredStatus === PaymentStatus.SUCCESS &&
            (order.status === OrderStatus.PAID ||
              order.status === OrderStatus.COMPLETED) &&
            paymentRecord?.status !== PaymentStatus.SUCCESS
          ) {
            throw new ConflictException(
              'Order already has a successful payment',
            );
          }

          if (!paymentRecord) {
            paymentRecord = await this.paymentsRepository.create(
              {
                orderId: dto.orderId,
                method: dto.method,
                amount,
                status: PaymentStatus.PENDING,
                reference: dto.reference,
                idempotencyKey: dto.idempotencyKey,
              },
              transactionClient,
            );
            emitPaymentRecorded = true;
          }

          if (desiredStatus !== PaymentStatus.PENDING) {
            const finalization = await this.finalizePaymentStatus(
              paymentRecord,
              desiredStatus,
              order,
              transactionClient,
            );

            paymentRecord = finalization.payment;
            emitPaymentSucceeded = finalization.emitPaymentSucceeded;
            emitPaymentFailed = finalization.emitPaymentFailed;
            emitOrderPaid = finalization.emitOrderPaid;
            emitOrderCancelled = finalization.emitOrderCancelled;
          }

          const refreshedOrder = (await this.paymentsRepository.lockOrderSummary(
            dto.orderId,
            transactionClient,
          )) as any;

          if (!refreshedOrder) {
            throw new NotFoundException('Order not found');
          }

          const paidAmount =
            await this.paymentsRepository.sumSuccessfulPayments(
              dto.orderId,
              transactionClient,
            );

          paymentPayload = {
            payment: {
              ...this.paymentSnapshot(paymentRecord),
              method: paymentRecord.method,
              reference: paymentRecord.reference ?? null,
            },
            order: this.orderPayload(refreshedOrder),
            orderFullyPaid:
              paymentRecord.status === PaymentStatus.SUCCESS &&
              paidAmount.gte(refreshedOrder.total),
          };

          if (!existingPayment) {
            this.auditService.logCreate(
              'PAYMENT',
              paymentRecord.id,
              this.paymentSnapshot(paymentRecord),
              { orderId: dto.orderId },
              context,
            );
          }

          const emittedPaymentPayload =
            paymentPayload as PaymentRecordedEventPayload;

          if (emitPaymentRecorded) {
            await this.eventBus.publish(
              SystemEvents.PAYMENT_RECORDED,
              emittedPaymentPayload,
              {
                userId: context?.actorId ?? undefined,
                source: 'payments',
              },
              transactionClient,
            );
          }

          if (emitPaymentSucceeded) {
            await this.eventBus.publish(
              SystemEvents.PAYMENT_SUCCEEDED,
              emittedPaymentPayload,
              {
                userId: context?.actorId ?? undefined,
                source: 'payments',
              },
              transactionClient,
            );
          }

          if (emitPaymentFailed) {
            await this.eventBus.publish(
              SystemEvents.PAYMENT_FAILED,
              emittedPaymentPayload,
              {
                userId: context?.actorId ?? undefined,
                source: 'payments',
              },
              transactionClient,
            );
          }

          if (emitOrderPaid) {
            await this.eventBus.publish(
              new OrderPaidEvent(emittedPaymentPayload.order, {
                userId: context?.actorId ?? undefined,
                source: 'payments',
              }),
              transactionClient,
            );
          }

          if (emitOrderCancelled) {
            await this.eventBus.publish(
              new OrderCancelledEvent(emittedPaymentPayload.order, {
                userId: context?.actorId ?? undefined,
                source: 'payments',
              }),
              transactionClient,
            );
          }

          return paymentRecord;
      };

      payment = transaction
        ? await persist(transaction)
        : await this.paymentsRepository.transaction(persist);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replayedPayment = await this.findExistingPaymentForReplay(dto);

        if (replayedPayment) {
          payment = replayedPayment;
          emitPaymentRecorded = true;
          emitPaymentSucceeded =
            replayedPayment.status === PaymentStatus.SUCCESS;
          emitPaymentFailed = replayedPayment.status === PaymentStatus.FAILED;
          emitOrderPaid = replayedPayment.status === PaymentStatus.SUCCESS;
          emitOrderCancelled = replayedPayment.status === PaymentStatus.FAILED;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (!paymentPayload) {
      const order = (await this.paymentsRepository.findOrderSummary(
        dto.orderId,
      )) as any;

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const paidAmount = await this.paymentsRepository.sumSuccessfulPayments(
        dto.orderId,
      );

      paymentPayload = {
        payment: {
          ...this.paymentSnapshot(payment),
          method: payment.method,
          reference: payment.reference ?? null,
        },
        order: this.orderPayload(order),
        orderFullyPaid:
          payment.status === PaymentStatus.SUCCESS &&
          paidAmount.gte(order.total),
      };
    }

    return payment;
  }

  async refundPayment(
    paymentId: string,
    reason?: string,
    context?: AuditContext,
  ) {
    let emitOrderRefunded = false;
    let refundPayload: PaymentRefundedEventPayload | null = null;

    let refundPayment: Awaited<
      ReturnType<PaymentsRepository['findById']>
    > extends infer T
      ? Exclude<T, null>
      : never;

    try {
      refundPayment = await this.paymentsRepository.transaction(
        async (transaction) => {
          const originalPayment = await this.paymentsRepository.lockPaymentById(
            paymentId,
            transaction,
          );

          if (!originalPayment) {
            throw new NotFoundException('Payment not found');
          }

          const order = (await this.paymentsRepository.lockOrderSummary(
            originalPayment.orderId,
            transaction,
          )) as any;

          if (!order) {
            throw new NotFoundException('Order not found');
          }

          if (originalPayment.status !== PaymentStatus.SUCCESS) {
            throw new BadRequestException(
              'Only successful payments can be refunded',
            );
          }

          const existingRefund =
            await this.paymentsRepository.findRefundForPayment(
              paymentId,
              transaction,
            );

          if (existingRefund) {
            emitOrderRefunded = true;
            refundPayload = {
              originalPayment: {
                ...this.paymentSnapshot(originalPayment),
                method: originalPayment.method,
                reference: originalPayment.reference ?? null,
              },
              refundPayment: {
                ...this.paymentSnapshot(existingRefund),
                method: existingRefund.method,
                reference: existingRefund.reference ?? null,
              },
              order: this.orderPayload(order),
            };

            return existingRefund;
          }

          const createdRefund = await this.paymentsRepository.create(
            {
              orderId: originalPayment.orderId,
              method: originalPayment.method,
              amount: originalPayment.amount.neg(),
              status: PaymentStatus.SUCCESS,
              reference: `refund:${paymentId}`,
              idempotencyKey: `refund:${paymentId}`,
              refundOfPaymentId: originalPayment.id,
            },
            transaction,
          );

          const orderStatusUpdate =
            await this.paymentsRepository.updateOrderStatusIfCurrent(
              order.id,
              [OrderStatus.PAID, OrderStatus.COMPLETED],
              OrderStatus.REFUNDED,
              transaction,
            );
          emitOrderRefunded = orderStatusUpdate.count === 1;

          const refreshedOrder = (await this.paymentsRepository.lockOrderSummary(
            order.id,
            transaction,
          )) as any;

          if (!refreshedOrder) {
            throw new NotFoundException('Order not found');
          }

          this.auditService.logAction(
            'PAYMENT_REFUNDED',
            'PAYMENT',
            originalPayment.id,
            this.paymentSnapshot(originalPayment),
            this.paymentSnapshot(createdRefund),
            {
              refundPaymentId: createdRefund.id,
              reason,
            },
            context,
          );

          refundPayload = {
            originalPayment: {
              ...this.paymentSnapshot(originalPayment),
              method: originalPayment.method,
              reference: originalPayment.reference ?? null,
            },
            refundPayment: {
              ...this.paymentSnapshot(createdRefund),
              method: createdRefund.method,
              reference: createdRefund.reference ?? null,
            },
            order: this.orderPayload(refreshedOrder),
          };

          const emittedRefundPayload =
            refundPayload as PaymentRefundedEventPayload;

          await this.eventBus.publish(
            SystemEvents.PAYMENT_REFUNDED,
            emittedRefundPayload,
            {
              userId: context?.actorId ?? undefined,
              source: 'payments',
            },
            transaction,
          );

          if (emitOrderRefunded) {
            await this.eventBus.publish(
              new OrderRefundedEvent(emittedRefundPayload.order, {
                userId: context?.actorId ?? undefined,
                source: 'payments',
              }),
              transaction,
            );
          }

          return createdRefund;
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingRefund =
          await this.paymentsRepository.findRefundForPayment(paymentId);

        if (existingRefund) {
          refundPayment = existingRefund;
          emitOrderRefunded = true;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (!refundPayload) {
      const refundPaymentRecord = refundPayment;
      const originalPayment = await this.findOne(paymentId);
      const order = (await this.paymentsRepository.findOrderSummary(
        originalPayment.orderId,
      )) as any;

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      refundPayload = {
        originalPayment: {
          ...this.paymentSnapshot(originalPayment),
          method: originalPayment.method,
          reference: originalPayment.reference ?? null,
        },
        refundPayment: {
          ...this.paymentSnapshot(refundPaymentRecord),
          method: refundPaymentRecord.method,
          reference: refundPaymentRecord.reference ?? null,
        },
        order: this.orderPayload(order),
      };
    }

    return refundPayment;
  }

  async findAll(query: PaginationQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const [payments, total] = await Promise.all([
      this.paymentsRepository.findMany({ skip, take }),
      this.paymentsRepository.count(),
    ]);

    return {
      data: payments,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async findOne(id: string) {
    const payment = await this.paymentsRepository.findById(id);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  private async findExistingPaymentForReplay(
    dto: RecordPaymentDto,
    transaction?: PaymentTransaction,
  ) {
    if (dto.idempotencyKey) {
      const payment = await this.paymentsRepository.findByIdempotencyKey(
        dto.idempotencyKey,
        transaction,
      );

      if (payment) {
        return payment;
      }
    }

    if (dto.reference) {
      return this.paymentsRepository.findByReference(
        dto.reference,
        transaction,
      );
    }

    return null;
  }

  private ensureReplayCompatibility(
    payment: {
      orderId: string;
      method: string;
      amount: Prisma.Decimal;
    },
    dto: RecordPaymentDto,
    amount: Prisma.Decimal,
  ) {
    if (
      payment.orderId !== dto.orderId ||
      payment.method !== dto.method ||
      !payment.amount.eq(amount)
    ) {
      throw new ConflictException(
        'Payment replay keys refer to a different payment request',
      );
    }
  }

  private async finalizePaymentStatus(
    payment: Awaited<ReturnType<PaymentsRepository['findById']>> extends infer T
      ? Exclude<T, null>
      : never,
    desiredStatus: PaymentStatus,
    order: any,
    transaction: PaymentTransaction,
  ) {
    if (payment.status === desiredStatus) {
      return {
        payment,
        emitPaymentSucceeded: false,
        emitPaymentFailed: false,
        emitOrderPaid: false,
        emitOrderCancelled: false,
      };
    }

    const allowedCurrentStatuses: PaymentStatus[] =
      desiredStatus === PaymentStatus.SUCCESS ||
      desiredStatus === PaymentStatus.FAILED
        ? [PaymentStatus.PENDING, PaymentStatus.AWAITING_VERIFICATION]
        : [PaymentStatus.PENDING];

    if (!allowedCurrentStatuses.includes(payment.status)) {
      throw new ConflictException(
        `Payment cannot transition from ${payment.status} to ${desiredStatus}`,
      );
    }

    const transition = await this.paymentsRepository.updateStatusIfCurrent(
      payment.id,
      payment.status,
      desiredStatus,
      transaction,
    );

    if (transition.count !== 1) {
      throw new ConflictException('Payment status was updated concurrently');
    }

    const updatedPayment = await this.paymentsRepository.lockPaymentById(
      payment.id,
      transaction,
    );

    if (!updatedPayment) {
      throw new NotFoundException('Payment not found');
    }

    if (desiredStatus === PaymentStatus.SUCCESS) {
      const paidAmount = await this.paymentsRepository.sumSuccessfulPayments(
        order.id,
        transaction,
      );
      const orderStatusUpdate =
        paidAmount.gte(order.total) && order.status === OrderStatus.PENDING
          ? await this.paymentsRepository.updateOrderStatusIfCurrent(
              order.id,
              [OrderStatus.PENDING],
              OrderStatus.PAID,
              transaction,
            )
          : { count: 0 };

      return {
        payment: updatedPayment,
        emitPaymentSucceeded: true,
        emitPaymentFailed: false,
        emitOrderPaid: orderStatusUpdate.count === 1,
        emitOrderCancelled: false,
      };
    }

    if (desiredStatus === PaymentStatus.FAILED) {
      const orderStatusUpdate =
        await this.paymentsRepository.updateOrderStatusIfCurrent(
          order.id,
          [OrderStatus.PENDING],
          OrderStatus.CANCELLED,
          transaction,
        );

      return {
        payment: updatedPayment,
        emitPaymentSucceeded: false,
        emitPaymentFailed: true,
        emitOrderPaid: false,
        emitOrderCancelled: orderStatusUpdate.count === 1,
      };
    }

    if (desiredStatus === PaymentStatus.AWAITING_VERIFICATION) {
      return {
        payment: updatedPayment,
        emitPaymentSucceeded: false,
        emitPaymentFailed: false,
        emitOrderPaid: false,
        emitOrderCancelled: false,
      };
    }

    throw new BadRequestException('Unsupported payment status transition');
  }

  private paymentSnapshot(payment: {
    id: string;
    orderId: string;
    amount: Prisma.Decimal;
    status: PaymentStatus;
    method: string;
    reference?: string | null;
    idempotencyKey?: string | null;
    refundOfPaymentId?: string | null;
  }) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount.toString(),
      status: payment.status,
      method: payment.method,
      reference: payment.reference ?? null,
      idempotencyKey: payment.idempotencyKey ?? null,
      refundOfPaymentId: payment.refundOfPaymentId ?? null,
    };
  }

  private orderPayload(order: any) {
    return {
      id: order.id,
      customerId: order.customerId,
      type: order.type,
      guestName: order.guestName ?? null,
      guestEmail: order.guestEmail ?? null,
      guestPhone: order.guestPhone ?? null,
      status: order.status,
      source: order.source,
      subtotal: order.subtotal.toString(),
      discount: order.discount.toString(),
      tax: order.tax.toString(),
      total: order.total.toString(),
      currency: order.currency,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        stockItemId: item.stockItemId,
        variantId: item.variantId,
        unitId: item.unitId,
        assetIds: this.parseAssetIds(item.assetIds),
        isStockTracked: item.product.isStockTracked,
        isSerialized: item.product.isSerialized,
        serialNumbers: this.parseSerialNumbers(item.serialNumbers),
        quantity: item.quantity.toString(),
        baseQuantity: (item.baseQuantity ?? item.quantity).toString(),
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
      })),
    };
  }

  private parseSerialNumbers(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private parseAssetIds(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }
}
