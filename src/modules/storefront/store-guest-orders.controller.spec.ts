import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

jest.mock('../../infrastructure/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { GuestOrderAccessGuard } from './guest-order-access.guard';
import { StoreGuestOrdersController } from './store-guest-orders.controller';
import { StoreGuestOrdersService } from './store-guest-orders.service';

describe('StoreGuestOrdersController', () => {
  let app: INestApplication;
  const storeGuestOrdersService = {
    requestLookup: jest.fn(),
    verifyLookup: jest.fn(),
    validateGuestAccessToken: jest.fn(),
    listOrders: jest.fn(),
    getOrder: jest.fn(),
    claimOrders: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [StoreGuestOrdersController],
      providers: [
        GuestOrderAccessGuard,
        {
          provide: StoreGuestOrdersService,
          useValue: storeGuestOrdersService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts the guest token in the x-guest-access-token header', async () => {
    storeGuestOrdersService.validateGuestAccessToken.mockResolvedValue({
      email: 'guest@example.com',
    });
    storeGuestOrdersService.listOrders.mockResolvedValue([
      { id: '11111111-1111-1111-1111-111111111111' },
    ]);

    await request(app.getHttpServer())
      .get('/store/guest-orders')
      .set('x-guest-access-token', 'header-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual([
          { id: '11111111-1111-1111-1111-111111111111' },
        ]);
      });

    expect(
      storeGuestOrdersService.validateGuestAccessToken,
    ).toHaveBeenCalledWith('header-token');
    expect(storeGuestOrdersService.listOrders).toHaveBeenCalledWith(
      'guest@example.com',
    );
  });

  it('accepts the guest token in the Authorization header', async () => {
    storeGuestOrdersService.validateGuestAccessToken.mockResolvedValue({
      email: 'guest@example.com',
    });
    storeGuestOrdersService.listOrders.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/store/guest-orders')
      .set('authorization', 'Guest auth-header-token')
      .expect(200);

    expect(
      storeGuestOrdersService.validateGuestAccessToken,
    ).toHaveBeenCalledWith('auth-header-token');
  });

  it('rejects guest tokens passed in the URL', async () => {
    await request(app.getHttpServer())
      .get('/store/guest-orders?guestAccessToken=url-token')
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toContain('Guest access tokens in URLs');
      });

    expect(
      storeGuestOrdersService.validateGuestAccessToken,
    ).not.toHaveBeenCalled();
  });

  it('rejects malformed UUID order ids before calling the service', async () => {
    storeGuestOrdersService.validateGuestAccessToken.mockResolvedValue({
      email: 'guest@example.com',
    });

    await request(app.getHttpServer())
      .get('/store/guest-orders/not-a-uuid')
      .set('x-guest-access-token', 'header-token')
      .expect(400);

    expect(storeGuestOrdersService.getOrder).not.toHaveBeenCalled();
  });

  it('still allows guest order detail access with a valid UUID and header token', async () => {
    const orderId = '11111111-1111-1111-1111-111111111111';
    storeGuestOrdersService.validateGuestAccessToken.mockResolvedValue({
      email: 'guest@example.com',
    });
    storeGuestOrdersService.getOrder.mockResolvedValue({
      id: orderId,
      status: 'PENDING',
    });

    await request(app.getHttpServer())
      .get(`/store/guest-orders/${orderId}`)
      .set('x-guest-access-token', 'header-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual({
          id: orderId,
          status: 'PENDING',
        });
      });

    expect(storeGuestOrdersService.getOrder).toHaveBeenCalledWith(
      'guest@example.com',
      orderId,
    );
  });
});
