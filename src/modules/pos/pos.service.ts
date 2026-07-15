import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  PaymentMethod,
  PaymentStatus,
  POSSessionStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ClosePOSSessionDto } from '../shared/dto/close-pos-session.dto';
import { CreatePOSSaleDto } from '../shared/dto/create-pos-sale.dto';
import { OpenPOSSessionDto } from '../shared/dto/open-pos-session.dto';

const posSessionSelect = {
  id: true,
  userId: true,
  openedAt: true,
  closedAt: true,
  cashInHand: true,
  expectedCash: true,
  countedCash: true,
  variance: true,
  reconciledAt: true,
  reconciledBy: true,
  status: true,
} as const;

@Injectable()
export class POSService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
  ) {}

  async openSession(
    userId: string,
    dto: OpenPOSSessionDto,
    context?: AuditContext,
  ) {
    const session = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM users
        WHERE id = ${userId}
        FOR UPDATE
      `;

      const existingSession = await transaction.pOSSession.findFirst({
        where: {
          userId,
          status: POSSessionStatus.OPEN,
        },
        select: {
          id: true,
        },
      });

      if (existingSession) {
        throw new BadRequestException('User already has an open POS session');
      }

      return transaction.pOSSession.create({
        data: {
          userId,
          cashInHand: new Prisma.Decimal(dto.cashInHand),
          status: POSSessionStatus.OPEN,
        },
        select: posSessionSelect,
      });
    });

    this.auditService.logAction(
      'POS_SESSION_OPENED',
      'POS_SESSION',
      session.id,
      null,
      this.sessionSnapshot(session),
      undefined,
      context,
    );

    return session;
  }

  async closeSession(dto: ClosePOSSessionDto, context?: AuditContext) {
    const { session, closedSession, cashSales, expectedCash } =
      await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT id
          FROM pos_sessions
          WHERE id = ${dto.sessionId}
          FOR UPDATE
        `;

        const session = await transaction.pOSSession.findUnique({
          where: { id: dto.sessionId },
          select: posSessionSelect,
        });

        if (!session) {
          throw new NotFoundException('POS session not found');
        }

        if (session.status !== POSSessionStatus.OPEN) {
          throw new BadRequestException('POS session is closed');
        }

        const cashPayments = await transaction.payment.aggregate({
          where: {
            method: PaymentMethod.CASH,
            status: PaymentStatus.SUCCESS,
            order: {
              posTransaction: {
                sessionId: dto.sessionId,
              },
            },
          },
          _sum: {
            amount: true,
          },
        });
        const cashSales = cashPayments._sum.amount ?? new Prisma.Decimal(0);
        const expectedCash = session.cashInHand.plus(cashSales);
        const countedCash =
          dto.countedCash === undefined
            ? null
            : new Prisma.Decimal(dto.countedCash);
        const variance =
          countedCash === null ? null : countedCash.minus(expectedCash);
        const closedSession = await transaction.pOSSession.update({
          where: { id: dto.sessionId },
          data: {
            status: POSSessionStatus.CLOSED,
            closedAt: new Date(),
            expectedCash,
            countedCash,
            variance,
            reconciledAt: new Date(),
            reconciledBy: context?.actorId,
          },
          select: posSessionSelect,
        });

        return { session, closedSession, cashSales, expectedCash };
      });

    this.auditService.logAction(
      'POS_SESSION_CLOSED',
      'POS_SESSION',
      closedSession.id,
      this.sessionSnapshot(session),
      this.sessionSnapshot(closedSession),
      undefined,
      context,
    );

    return {
      ...closedSession,
      reconciliation: {
        openingCash: session.cashInHand.toString(),
        cashSales: cashSales.toString(),
        expectedCash: closedSession.expectedCash?.toString() ?? expectedCash.toString(),
        countedCash: closedSession.countedCash?.toString() ?? null,
        variance: closedSession.variance?.toString() ?? null,
      },
    };
  }

  async createSale(dto: CreatePOSSaleDto, context?: AuditContext) {
    if (!dto.idempotencyKey && !dto.paymentReference) {
      throw new BadRequestException(
        'POS sales require a unique idempotency key or payment reference',
      );
    }

    const saleRequestKey =
      dto.idempotencyKey ??
      `pos-sale:${dto.sessionId}:${dto.paymentReference}`;

    const result = await this.prisma.$transaction(async (transactionClient) => {
      const session = await transactionClient.pOSSession.findUnique({
        where: { id: dto.sessionId },
        select: posSessionSelect,
      });

      if (!session) {
        throw new NotFoundException('POS session not found');
      }

      if (session.status !== POSSessionStatus.OPEN) {
        throw new BadRequestException('POS session is closed');
      }

      const order = await this.ordersService.createPOSOrder(
        dto,
        context,
        { requestKey: saleRequestKey },
        transactionClient,
      );
      const payment = await this.paymentsService.recordPayment(
        {
          orderId: order.id,
          method: dto.paymentMethod,
          amount: dto.amount,
          status: PaymentStatus.SUCCESS,
          reference: dto.paymentReference,
          idempotencyKey:
            dto.idempotencyKey ??
            dto.paymentReference ??
            `pos-sale:${dto.sessionId}:${order.id}`,
        },
        context,
        transactionClient,
      );
      const posTransaction = await transactionClient.pOSTransaction.upsert({
        where: { orderId: order.id },
        create: {
          sessionId: dto.sessionId,
          orderId: order.id,
          total: order.total,
        },
        update: {},
      });

      return { order, payment, transaction: posTransaction };
    });

    const { order, payment, transaction } = result;
    const createdTransaction = true;

    if (createdTransaction) {
      this.auditService.logCreate(
        'POS_TRANSACTION',
        transaction.id,
        {
          id: transaction.id,
          sessionId: transaction.sessionId,
          orderId: transaction.orderId,
          total: transaction.total.toString(),
        },
        { paymentId: payment.id },
        context,
      );
    }

    return {
      order,
      payment,
      transaction,
    };
  }

  private async compensatePendingOrder(
    orderId: string,
    context?: AuditContext,
  ) {
    try {
      await this.ordersService.cancel(orderId, context);
    } catch {
      // Best-effort compensation keeps the original failure surface intact.
    }
  }

  private async compensateSuccessfulSale(
    orderId: string,
    paymentId: string,
    context?: AuditContext,
  ) {
    try {
      await this.paymentsService.refundPayment(
        paymentId,
        'POS sale compensation after transaction persistence failure',
        context,
      );
      return;
    } catch {
      // Fall through to best-effort order cancellation when refund creation fails.
    }

    await this.compensatePendingOrder(orderId, context);
  }

  async findSessions() {
    return this.prisma.pOSSession.findMany({
      select: posSessionSelect,
      orderBy: {
        openedAt: 'desc',
      },
    });
  }

  async listSessions(query?: {
    page?: number;
    limit?: number;
    status?: POSSessionStatus;
    userId?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 20));
    const where = {
      status: query?.status,
      userId: query?.userId,
    };
    const [data, total] = await Promise.all([
      this.prisma.pOSSession.findMany({
        where,
        select: posSessionSelect,
        orderBy: { openedAt: query?.sortOrder ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pOSSession.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getSession(id: string) {
    const session = await this.prisma.pOSSession.findUnique({
      where: { id },
      include: {
        user: true,
        transactions: {
          include: {
            order: {
              include: {
                items: true,
                payments: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('POS session not found');
    }

    return session;
  }

  async listSales(query?: {
    page?: number;
    limit?: number;
    sessionId?: string;
    q?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 20));
    const where = {
      sessionId: query?.sessionId,
      OR: query?.q
        ? [
            { orderId: { contains: query.q } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.pOSTransaction.findMany({
        where,
        include: {
          session: {
            select: posSessionSelect,
          },
          order: {
            include: {
              items: {
                include: {
                  product: true,
                  stockItem: true,
                  variant: true,
                  unit: true,
                },
              },
              payments: true,
              customer: true,
            },
          },
        },
        orderBy: { createdAt: query?.sortOrder ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pOSTransaction.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getSale(id: string) {
    const sale = await this.prisma.pOSTransaction.findUnique({
      where: { id },
      include: {
        session: {
          select: posSessionSelect,
        },
        order: {
          include: {
            items: {
              include: {
                product: true,
                stockItem: true,
                variant: true,
                unit: true,
              },
            },
            payments: true,
            customer: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('POS sale not found');
    }

    return sale;
  }

  private async findOpenSession(sessionId: string) {
    const session = await this.prisma.pOSSession.findUnique({
      where: { id: sessionId },
      select: posSessionSelect,
    });

    if (!session) {
      throw new NotFoundException('POS session not found');
    }

    if (session.status !== POSSessionStatus.OPEN) {
      throw new BadRequestException('POS session is closed');
    }

    return session;
  }

  private sessionSnapshot(session: {
    id: string;
    userId: string;
    status: POSSessionStatus;
    cashInHand: Prisma.Decimal;
    expectedCash?: Prisma.Decimal | null;
    countedCash?: Prisma.Decimal | null;
    variance?: Prisma.Decimal | null;
    reconciledAt?: Date | null;
    reconciledBy?: string | null;
    openedAt: Date;
    closedAt: Date | null;
  }) {
    return {
      id: session.id,
      userId: session.userId,
      status: session.status,
      cashInHand: session.cashInHand.toString(),
      expectedCash: session.expectedCash?.toString() ?? null,
      countedCash: session.countedCash?.toString() ?? null,
      variance: session.variance?.toString() ?? null,
      reconciledAt: session.reconciledAt ?? null,
      reconciledBy: session.reconciledBy ?? null,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
    };
  }
}
