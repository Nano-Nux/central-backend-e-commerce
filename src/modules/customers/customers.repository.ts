import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const customerDetailSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  type: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  addresses: true,
  tags: {
    select: {
      tag: true,
    },
  },
  notes: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  },
  activities: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 30,
  },
  orders: {
    select: {
      id: true,
      status: true,
      source: true,
      total: true,
      currency: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  },
} as const;

const customerListSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  type: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CustomerUncheckedCreateInput) {
    return this.prisma.customer.create({
      data,
      select: customerDetailSelect,
    });
  }

  findMany(params: {
    where: Prisma.CustomerWhereInput;
    skip: number;
    take: number;
  }) {
    return this.prisma.customer.findMany({
      where: params.where,
      skip: params.skip,
      take: params.take,
      select: customerListSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  count(where: Prisma.CustomerWhereInput) {
    return this.prisma.customer.count({ where });
  }

  findOrdersByCustomer(customerId: string, skip: number, take: number) {
    return Promise.all([
      this.prisma.order.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where: { customerId } }),
    ]);
  }

  findMessagesByCustomer(customerId: string, skip: number, take: number) {
    const where = { conversation: { customerId } } satisfies Prisma.MessageWhereInput;
    return Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.message.count({ where }),
    ]);
  }

  findById(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      select: customerDetailSelect,
    });
  }

  findByUserId(userId: string) {
    return this.prisma.customer.findFirst({
      where: { userId },
      select: customerDetailSelect,
    });
  }

  update(id: string, data: Prisma.CustomerUncheckedUpdateInput) {
    return this.prisma.customer.update({
      where: { id },
      data,
      select: customerDetailSelect,
    });
  }

  delete(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }

  buildWhere(params: {
    q?: string;
    type?: Prisma.CustomerWhereInput['type'];
  }): Prisma.CustomerWhereInput {
    return {
      type: params.type,
      OR: params.q
        ? [
            { name: { contains: params.q } },
            { phone: { contains: params.q } },
            { email: { contains: params.q } },
          ]
        : undefined,
    };
  }
}
