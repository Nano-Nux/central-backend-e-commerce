import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { SupplierInvoiceStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SupplierInvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.SupplierInvoiceCreateInput,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prisma).supplierInvoice.create({ data });
  }

  findMany() {
    return this.prisma.supplierInvoice.findMany({
      orderBy: { id: 'desc' },
    });
  }

  findById(id: string, transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.prisma).supplierInvoice.findUnique({
      where: { id },
    });
  }

  updateStatus(
    id: string,
    status: SupplierInvoiceStatus,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prisma).supplierInvoice.update({
      where: { id },
      data: { status },
    });
  }

  async paidAmount(id: string, transaction?: Prisma.TransactionClient) {
    const result = await (transaction ?? this.prisma).supplierPayment.aggregate({
      where: { supplierInvoiceId: id },
      _sum: { amount: true },
    });

    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  transaction<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(callback);
  }
}
