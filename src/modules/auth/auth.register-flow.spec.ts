import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(message: string, options: { code: string }) {
        super(message);
        this.code = options.code;
      }
    },
  },
}));

jest.mock('../../infrastructure/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

function createPrismaUniqueConstraintError() {
  const { Prisma } = require('../../../generated/prisma/client');

  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
  });
}

describe('Auth register flow', () => {
  let app: INestApplication;
  const usersService = {
    createWithPasswordHash: jest.fn(),
  };
  const prismaService = {
    $transaction: jest.fn(),
  };
  const transaction = {
    customer: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    order: {
      updateMany: jest.fn(),
    },
  };
  const configService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const auditService = {
    logAction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaService.$transaction.mockImplementation((callback: never) =>
      callback(transaction),
    );
    transaction.customer.findFirst.mockResolvedValue(null);
    transaction.customer.create.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
    });
    transaction.order.updateMany.mockResolvedValue({ count: 0 });

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: AuditService,
          useValue: auditService,
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

  it('returns the same API message for new and existing email registration attempts', async () => {
    usersService.createWithPasswordHash
      .mockResolvedValueOnce({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'New User',
        email: 'new@example.com',
      })
      .mockRejectedValueOnce(createPrismaUniqueConstraintError());

    const newEmailResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'New User',
        email: 'new@example.com',
        password: 'Valid@123',
      })
      .expect(202);

    const existingEmailResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'Valid@123',
      })
      .expect(202);

    expect(newEmailResponse.body).toEqual({
      success: true,
      message: 'Registration request received.',
    });
    expect(existingEmailResponse.body).toEqual({
      success: true,
      message: 'Registration request received.',
    });
  });
});
