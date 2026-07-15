import { PaymentMethod } from '../../../generated/prisma/enums';
import { StoreCheckoutService } from './store-checkout.service';

jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {},
}));

jest.mock('../../infrastructure/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

function decimalLike(value: number | string) {
  return {
    toString: () => String(value),
  };
}

describe('StoreCheckoutService', () => {
  const ordersService = {
    create: jest.fn(),
  };
  const paymentsService = {
    recordPayment: jest.fn(),
  };
  const appConfigService = {
    getApiBaseUrl: jest.fn(),
  };
  const merchantPaymentConfigurationsService = {
    resolveActiveConfiguration: jest.fn(),
  };
  const usersRepository = {
    findIdentityById: jest.fn(),
  };
  const prisma = {
    payment: {
      update: jest.fn(),
    },
    guestOrderAccessToken: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: StoreCheckoutService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback: never) =>
      callback({
        $queryRaw: jest.fn(),
        customer: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        payment: {
          update: prisma.payment.update,
        },
        guestOrderAccessToken: {
          create: prisma.guestOrderAccessToken.create,
        },
      }),
    );
    service = new StoreCheckoutService(
      ordersService as never,
      paymentsService as never,
      appConfigService as never,
      merchantPaymentConfigurationsService as never,
      usersRepository as never,
      prisma as never,
    );
  });

  it('keeps guest checkout working while removing guest tokens from upload URLs', async () => {
    const orderId = '11111111-1111-1111-1111-111111111111';
    appConfigService.getApiBaseUrl.mockReturnValue('https://api.example.com');
    merchantPaymentConfigurationsService.resolveActiveConfiguration.mockResolvedValue(
      {
        id: 'merchant-config-id',
        providerName: 'TH_PROMPTPAY',
        countryCode: 'TH',
        accountName: 'Merchant',
        accountNumber: '1234567890',
        qrImageUrl: 'https://cdn.example.com/qr.png',
      },
    );
    ordersService.create.mockResolvedValue({
      id: orderId,
      total: decimalLike(100),
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      guestPhone: '0912345678',
    });
    paymentsService.recordPayment.mockResolvedValue({
      id: 'payment-id',
      method: PaymentMethod.QR_MANUAL,
      amount: decimalLike(100),
      status: 'AWAITING_VERIFICATION',
      reference: `qr-manual:${orderId}`,
    });
    prisma.payment.update.mockResolvedValue({
      id: 'payment-id',
      method: PaymentMethod.QR_MANUAL,
      amount: decimalLike(100),
      status: 'AWAITING_VERIFICATION',
      reference: `qr-manual:${orderId}`,
    });
    prisma.guestOrderAccessToken.create.mockResolvedValue({});

    const result = await service.checkout({
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      guestPhone: '0912345678',
      orderNotes: 'Please verify',
      paymentMethod: PaymentMethod.QR_MANUAL,
      items: [
        {
          productId: '22222222-2222-2222-2222-222222222222',
          quantity: 1,
        },
      ],
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.manualPayment?.uploadProofUrl).toBe(
      `https://api.example.com/store/guest-orders/${orderId}/payment-proofs`,
    );
    expect(result.manualPayment?.uploadProofUrl).not.toContain(
      'guestAccessToken=',
    );
    expect(result.manualPayment?.uploadProofUrl).not.toContain('accessToken=');
  });

  it('keeps authenticated checkout working without requiring guest email', async () => {
    const orderId = '11111111-1111-1111-1111-111111111111';
    appConfigService.getApiBaseUrl.mockReturnValue('https://api.example.com');
    prisma.$transaction.mockImplementation(async (callback: never) =>
      callback({
        $queryRaw: jest.fn(),
        customer: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'customer-id',
          }),
          create: jest.fn(),
        },
        payment: {
          update: prisma.payment.update,
        },
        guestOrderAccessToken: {
          create: prisma.guestOrderAccessToken.create,
        },
      }),
    );
    usersRepository.findIdentityById.mockResolvedValue({
      id: 'user-id',
      name: 'Customer',
      email: 'customer@example.com',
    });
    ordersService.create.mockResolvedValue({
      id: orderId,
      total: decimalLike(100),
      guestName: null,
      guestEmail: null,
      guestPhone: null,
    });
    paymentsService.recordPayment.mockResolvedValue({
      id: 'payment-id',
      method: PaymentMethod.ONLINE,
      amount: decimalLike(100),
      status: 'PENDING',
      reference: null,
    });
    prisma.payment.update.mockResolvedValue({
      id: 'payment-id',
      method: PaymentMethod.ONLINE,
      amount: decimalLike(100),
      status: 'PENDING',
      reference: null,
    });

    const result = await service.checkout(
      {
        orderNotes: 'Handle with care',
        paymentMethod: PaymentMethod.ONLINE,
        items: [
          {
            productId: '22222222-2222-2222-2222-222222222222',
            quantity: 1,
          },
        ],
      },
      {
        actorId: 'user-id',
      },
    );

    expect(ordersService.create).toHaveBeenCalled();
    expect(result.accessToken).toBeNull();
    expect(result.guest.email).toBeNull();
  });
});
