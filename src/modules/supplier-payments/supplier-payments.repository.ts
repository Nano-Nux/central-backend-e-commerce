import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SupplierPaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.SupplierPaymentCreateInput,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prisma).supplierPayment.create({ data });
  }

  findMany() {
    return this.prisma.supplierPayment.findMany({
      orderBy: { paymentDate: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.supplierPayment.findUnique({
      where: { id },
      include: { supplierInvoice: true },
    });
  }

  transaction<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(callback);
  }
}
