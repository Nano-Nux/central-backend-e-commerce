import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const journalEntrySelect = {
  id: true,
  referenceType: true,
  referenceId: true,
  eventKey: true,
  description: true,
  createdAt: true,
  lines: {
    select: {
      id: true,
      accountId: true,
      debit: true,
      credit: true,
      account: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class JournalRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(callback, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  createEntry(
    data: Prisma.JournalEntryCreateInput,
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.journalEntry.create({
      data,
      select: journalEntrySelect,
    });
  }

  findById(id: string) {
    return this.prisma.journalEntry.findUnique({
      where: { id },
      select: journalEntrySelect,
    });
  }

  async findPage(input: {
    skip: number;
    take: number;
    referenceType?: Prisma.JournalEntryWhereInput['referenceType'];
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.JournalEntryWhereInput = {
      referenceType: input.referenceType,
      createdAt:
        input.from || input.to
          ? { gte: input.from, lte: input.to }
          : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        select: journalEntrySelect,
        orderBy: { createdAt: 'desc' },
        skip: input.skip,
        take: input.take,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return { data, total };
  }

  findByEventKey(eventKey: string, transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.prisma).journalEntry.findUnique({
      where: { eventKey },
      select: journalEntrySelect,
    });
  }
}
