import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { OrderStatus, PaymentStatus, PaymentProviderSessionStatus, PaymentProviderType } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditContext } from '../audit/audit.service';
import { PaymentsService } from './payments.service';
import { PaymentProviderRegistryService } from './payment-provider-registry.service';

const providerSessionSelect = {
  id: true,
  paymentId: true,
  orderId: true,
  provider: true,
  providerSessionId: true,
  status: true,
  paymentUrl: true,
  returnUrl: true,
  cancelUrl: true,
  confirmedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PaymentProviderSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly paymentProviderRegistry: PaymentProviderRegistryService,
  ) {}

  async createLinePaySession(input: {
    orderId: string;
    paymentId?: string;
    returnUrl: string;
    cancelUrl?: string;
  }) {
    const payment = await this.resolveLinePayPayment(
      input.orderId,
      input.paymentId,
    );
    const linePayProvider = this.paymentProviderRegistry.get(
      PaymentProviderType.LINE_PAY,
    );
    const session = await linePayProvider.createHostedSession({
      orderId: payment.orderId,
      paymentId: payment.id,
      amount: payment.amount.toString(),
      currency: payment.order.currency,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
    });

    return this.prisma.paymentProviderSession.create({
      data: {
        orderId: payment.orderId,
        paymentId: payment.id,
        provider: session.provider,
        providerSessionId: session.providerSessionId,
        status: session.status,
        paymentUrl: session.paymentUrl,
        returnUrl: session.returnUrl,
        cancelUrl: session.cancelUrl,
        callbackDataJson: session.callbackData as Prisma.InputJsonValue | undefined,
        expiresAt: session.expiresAt,
      },
      select: providerSessionSelect,
    });
  }

  async handleLinePayReturnCallback(input: {
    providerSessionId: string;
    transactionId?: string;
  }) {
    const session = await this.prisma.paymentProviderSession.findUnique({
      where: { providerSessionId: input.providerSessionId },
      select: {
        id: true,
        callbackDataJson: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Payment provider session not found');
    }

    await this.prisma.paymentProviderSession.update({
      where: { id: session.id },
      data: {
        callbackDataJson: {
          ...(this.toRecord(session.callbackDataJson) ?? {}),
          returnCallback: {
            transactionId: input.transactionId ?? null,
            receivedAt: new Date().toISOString(),
          },
        },
      },
    });

    return this.getSessionByProviderId(input.providerSessionId);
  }

  async confirmLinePaySession(
    providerSessionId: string,
    context?: AuditContext,
  ) {
    const outcome = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM payment_provider_sessions
        WHERE provider_session_id = ${providerSessionId}
        FOR UPDATE
      `;

      const session = await transaction.paymentProviderSession.findUnique({
        where: { providerSessionId },
        select: {
          id: true,
          paymentId: true,
          orderId: true,
          providerSessionId: true,
          provider: true,
          status: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Payment provider session not found');
      }

      if (session.provider !== PaymentProviderType.LINE_PAY) {
        throw new BadRequestException('Unsupported payment provider session');
      }

      if (session.status === PaymentProviderSessionStatus.CONFIRMED) {
        return {
          session: await transaction.paymentProviderSession.findUniqueOrThrow({
            where: { providerSessionId },
            select: providerSessionSelect,
          }),
          payment: await transaction.payment.findUniqueOrThrow({
            where: { id: session.paymentId },
            select: {
              id: true,
              orderId: true,
              amount: true,
              method: true,
              status: true,
              reference: true,
              idempotencyKey: true,
            },
          }),
          shouldFinalizePayment: false,
        };
      }

      if (
        session.status === PaymentProviderSessionStatus.CANCELLED ||
        session.status === PaymentProviderSessionStatus.FAILED ||
        session.status === PaymentProviderSessionStatus.EXPIRED
      ) {
        throw new ConflictException(
          `LINE Pay session cannot be confirmed from ${session.status}`,
        );
      }

      const payment = await transaction.payment.findUnique({
        where: { id: session.paymentId },
        select: {
          id: true,
          orderId: true,
          amount: true,
          method: true,
          status: true,
          reference: true,
          idempotencyKey: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      const updatedSession = await transaction.paymentProviderSession.update({
        where: { providerSessionId },
        data: {
          status: PaymentProviderSessionStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
        select: providerSessionSelect,
      });

      return {
        session: updatedSession,
        payment,
        shouldFinalizePayment: payment.status !== PaymentStatus.SUCCESS,
      };
    });

    if (outcome.shouldFinalizePayment) {
      await this.paymentsService.recordPayment(
        {
          orderId: outcome.payment.orderId,
          method: outcome.payment.method,
          amount: Number(outcome.payment.amount.toString()),
          status: PaymentStatus.SUCCESS,
          reference:
            outcome.payment.reference ?? `line-pay:${providerSessionId}`,
          idempotencyKey:
            outcome.payment.idempotencyKey ??
            `line-pay-confirmation:${outcome.payment.id}`,
        },
        context,
      );
    }

    return this.getSessionByProviderId(providerSessionId);
  }

  async handleLinePayWebhook(
    input: {
      providerSessionId: string;
      transactionId?: string;
    },
    _context?: AuditContext,
  ) {
    const session = await this.prisma.paymentProviderSession.findUnique({
      where: { providerSessionId: input.providerSessionId },
      select: {
        id: true,
        callbackDataJson: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Payment provider session not found');
    }

    await this.prisma.paymentProviderSession.update({
      where: { id: session.id },
      data: {
        callbackDataJson: {
          ...(this.toRecord(session.callbackDataJson) ?? {}),
          webhook: {
            transactionId: input.transactionId ?? null,
            receivedAt: new Date().toISOString(),
          },
        },
      },
    });

    return this.getSessionByProviderId(input.providerSessionId);
  }

  async getSessionByProviderId(providerSessionId: string) {
    const session = await this.prisma.paymentProviderSession.findUnique({
      where: { providerSessionId },
      select: providerSessionSelect,
    });

    if (!session) {
      throw new NotFoundException('Payment provider session not found');
    }

    return session;
  }

  private async resolveLinePayPayment(orderId: string, paymentId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        currency: true,
        status: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderId: true,
            method: true,
            amount: true,
            status: true,
            reference: true,
            idempotencyKey: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'LINE Pay session is not allowed for this order',
      );
    }

    const payment = paymentId
      ? order.payments.find((entry) => entry.id === paymentId)
      : order.payments.find((entry) => entry.status === PaymentStatus.PENDING) ??
        order.payments[0];

    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      throw new ConflictException('Payment has already been completed');
    }

    if (payment.method !== 'ONLINE') {
      throw new BadRequestException(
        'LINE Pay sessions require an ONLINE payment record',
      );
    }

    return {
      ...payment,
      order,
    };
  }

  private toRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}
