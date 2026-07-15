import { BadRequestException } from '@nestjs/common';

jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    Decimal: class Decimal {
      constructor(private readonly value: string | number) {}

      toString() {
        return String(this.value);
      }
    },
  },
  PrismaClient: class PrismaClient {},
}));

import { PaymentMethod } from '../../../generated/prisma/enums';
import { POSService } from './pos.service';

describe('POSService', () => {
  let service: POSService;
  let prisma: any;
  let ordersService: any;
  let paymentsService: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      pOSSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          status: 'OPEN',
          userId: 'user-1',
          cashInHand: { toString: () => '0' },
        }),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      pOSTransaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    ordersService = {
      createPOSOrder: jest.fn(),
    };
    paymentsService = {
      recordPayment: jest.fn(),
    };
    auditService = {
      logCreate: jest.fn(),
      logAction: jest.fn(),
    };

    service = new POSService(
      prisma,
      ordersService,
      paymentsService,
      auditService,
    );
  });

  it('requires a unique replay key for POS sales', async () => {
    await expect(
      service.createSale({
        sessionId: 'session-1',
        paymentMethod: PaymentMethod.CASH,
        amount: 100,
        items: [
          {
            productId: 'product-1',
            quantity: 1,
          },
        ],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'POS sales require a unique idempotency key or payment reference',
      ),
    );
  });
});
