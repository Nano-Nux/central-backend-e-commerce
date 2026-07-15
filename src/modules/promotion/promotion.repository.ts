import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const voucherSelect = {
  id: true,
  code: true,
  description: true,
  discountType: true,
  discountValue: true,
  minimumOrderAmount: true,
  startAt: true,
  endAt: true,
  usageLimit: true,
  usedCount: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PromotionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.VoucherUncheckedCreateInput) {
    return this.prisma.voucher.create({ data, select: voucherSelect });
  }

  findById(id: string) {
    return this.prisma.voucher.findUnique({ where: { id }, select: voucherSelect });
  }

  findByCode(code: string) {
    return this.prisma.voucher.findUnique({ where: { code }, select: voucherSelect });
  }

  findAll(page: number, limit: number, q?: string) {
    const where: Prisma.VoucherWhereInput = q?.trim()
      ? { code: { contains: q.trim().toUpperCase() } }
      : {};
    return this.prisma.voucher.findMany({
      where,
      select: voucherSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(q?: string) {
    const where: Prisma.VoucherWhereInput = q?.trim()
      ? { code: { contains: q.trim().toUpperCase() } }
      : {};
    return this.prisma.voucher.count({ where });
  }

  update(id: string, data: Prisma.VoucherUncheckedUpdateInput) {
    return this.prisma.voucher.update({ where: { id }, data, select: voucherSelect });
  }

  delete(id: string) {
    return this.prisma.voucher.delete({ where: { id }, select: voucherSelect });
  }

  consume(id: string, transaction: Prisma.TransactionClient) {
    return transaction.$executeRaw`
      UPDATE vouchers
      SET used_count = used_count + 1
      WHERE id = ${id}
        AND is_active = true
        AND (usage_limit IS NULL OR used_count < usage_limit)
    `;
  }
}
