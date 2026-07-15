import { ConflictException } from '@nestjs/common';

import { OrderStatus, PaymentMethod, PaymentStatus } from '../../../generated/prisma/enums';

jest.mock('../../../generated/prisma/client', () => {
  class Decimal {
    private readonly value: number;

    constructor(value: string | number | { value: number }) {
      this.value =
        typeof value === 'object' && value !== null && 'value' in value
          ? Number(value.value)
          : Number(value);
    }

    eq(other: Decimal) {
      return this.value === Number(other.valueOf());
    }

    valueOf() {
      return this.value;
    }

    toString() {
      return String(this.value);
    }
  }

  return {
    Prisma: {
      Decimal,
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;

        constructor(message: string, options: { code: string }) {
          super(message);
          this.code = options.code;
        }
      },
    },
  };
});

jest.mock('../../infrastructure/event-bus/event-bus.service', () => ({
  EventBusService: class EventBusService {},
}));

jest.mock('../audit/audit.service', () => ({
  AuditService: class AuditService {},
}));

jest.mock('./payments.repository', () => ({
  PaymentsRepository: class PaymentsRepository {},
}));

const { EventBusService } = require('../../infrastructure/event-bus/event-bus.service');
const { Prisma } = require('../../../generated/prisma/client');
const { PaymentsService } = require('./payments.service');

describe('PaymentsService duplicate successful payment protection', () => {
  let service: PaymentsService;
  let paymentsRepository: {
    transaction: jest.Mock;
    findByIdempotencyKey: jest.Mock;
    findByReference: jest.Mock;
    lockOrderSummary: jest.Mock;
    create: jest.Mock;
    lockPaymentById: jest.Mock;
    sumSuccessfulPayments: jest.Mock;
    updateStatusIfCurrent: jest.Mock;
    updateOrderStatusIfCurrent: jest.Mock;
    findById: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
    findRefundForPayment: jest.Mock;
    findOrderSummary: jest.Mock;
  };
  let auditService: {
    logCreate: jest.Mock;
    logAction: jest.Mock;
  };
  let eventBus: {
    emit: jest.Mock;
  };

  beforeEach(() => {
    paymentsRepository = {
      transaction: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findByReference: jest.fn(),
      lockOrderSummary: jest.fn(),
      create: jest.fn(),
      lockPaymentById: jest.fn(),
      sumSuccessfulPayments: jest.fn(),
      updateStatusIfCurrent: jest.fn(),
      updateOrderStatusIfCurrent: jest.fn(),
      findById: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findRefundForPayment: jest.fn(),
      findOrderSummary: jest.fn(),
    };
    auditService = {
      logCreate: jest.fn(),
      logAction: jest.fn(),
    };
    eventBus = {
      emit: jest.fn(),
    };

    paymentsRepository.transaction.mockImplementation(async (callback) =>
      callback({} as never),
    );

    service = new PaymentsService(
      paymentsRepository as never,
      auditService as never,
      eventBus as InstanceType<typeof EventBusService>,
    );
  });

  it('rejects a new successful payment when the order is already PAID', async () => {
    paymentsRepository.findByIdempotencyKey.mockResolvedValue(null);
    paymentsRepository.lockOrderSummary.mockResolvedValue({
      id: 'order-1',
      customerId: null,
      type: 'CUSTOMER',
      guestName: null,
      guestEmail: null,
      guestPhone: null,
      status: OrderStatus.PAID,
      source: 'ONLINE',
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
      currency: 'THB',
      items: [],
    });

    await expect(
      service.recordPayment({
        orderId: 'order-1',
        method: PaymentMethod.CASH,
        amount: 100,
        status: PaymentStatus.SUCCESS,
        idempotencyKey: 'second-payment',
      }),
    ).rejects.toThrow(new ConflictException('Order already has a successful payment'));

    expect(paymentsRepository.create).not.toHaveBeenCalled();
    expect(paymentsRepository.updateStatusIfCurrent).not.toHaveBeenCalled();
  });

  it('rejects completing a pending payment when the order is already COMPLETED', async () => {
    paymentsRepository.findByIdempotencyKey.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      method: PaymentMethod.CASH,
      amount: new Prisma.Decimal(100),
      status: PaymentStatus.PENDING,
      reference: null,
      idempotencyKey: 'payment-1',
      refundOfPaymentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    paymentsRepository.lockOrderSummary.mockResolvedValue({
      id: 'order-1',
      customerId: null,
      type: 'CUSTOMER',
      guestName: null,
      guestEmail: null,
      guestPhone: null,
      status: OrderStatus.COMPLETED,
      source: 'ONLINE',
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
      currency: 'THB',
      items: [],
    });

    await expect(
      service.recordPayment({
        orderId: 'order-1',
        method: PaymentMethod.CASH,
        amount: 100,
        status: PaymentStatus.SUCCESS,
        idempotencyKey: 'payment-1',
      }),
    ).rejects.toThrow(new ConflictException('Order already has a successful payment'));

    expect(paymentsRepository.updateStatusIfCurrent).not.toHaveBeenCalled();
  });
});
