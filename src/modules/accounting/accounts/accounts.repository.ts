import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../../generated/prisma/client';
import { AccountType } from '../../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AccountCreateInput) {
    return this.prisma.account.create({ data });
  }

  upsertByCode(data: {
    code: string;
    name: string;
    type: AccountType;
    isActive?: boolean;
  }) {
    return this.prisma.account.upsert({
      where: { code: data.code },
      create: {
        code: data.code,
        name: data.name,
        type: data.type,
        isActive: data.isActive ?? true,
      },
      update: {
        name: data.name,
        type: data.type,
        isActive: data.isActive ?? true,
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.account.findUnique({
      where: { code },
    });
  }

  findById(id: string) {
    return this.prisma.account.findUnique({ where: { id } });
  }

  findByType(type: AccountType) {
    return this.prisma.account.findMany({
      where: {
        type,
        isActive: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  findMany() {
    return this.prisma.account.findMany({
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findPage(input: {
    skip: number;
    take: number;
    type?: AccountType;
  }) {
    const where = { type: input.type, isActive: true };
    const [data, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: input.skip,
        take: input.take,
      }),
      this.prisma.account.count({ where }),
    ]);
    return { data, total };
  }

  update(id: string, data: Prisma.AccountUpdateInput) {
    return this.prisma.account.update({ where: { id }, data });
  }
}
