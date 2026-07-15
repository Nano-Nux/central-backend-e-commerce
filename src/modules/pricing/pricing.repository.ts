import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { randomUUID } from 'node:crypto';

const pricingSelect = {
  sellingPrice: true,
  wholesalePrice: true,
  memberPrice: true,
  promotionPrice: true,
  promotionStartAt: true,
  promotionEndAt: true,
} satisfies Prisma.ProductPricingSelect;

@Injectable()
export class PricingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProduct(productId: string, variantId?: string | null) {
    return this.prisma.productPricing.findFirst({
      where: {
        productId,
        variantId: variantId ?? null,
      },
      select: pricingSelect,
      orderBy: {
        id: 'asc',
      },
    });
  }

  async upsert(input: {
    productId: string;
    variantId?: string | null;
    costPrice: Prisma.Decimal;
    sellingPrice: Prisma.Decimal;
    wholesalePrice?: Prisma.Decimal | null;
    memberPrice?: Prisma.Decimal | null;
    promotionPrice?: Prisma.Decimal | null;
    promotionStartAt?: Date | null;
    promotionEndAt?: Date | null;
  }) {
    const existing = await this.prisma.productPricing.findFirst({
      where: { productId: input.productId, variantId: input.variantId ?? null },
      select: { id: true },
    });
    return existing
      ? this.prisma.productPricing.update({ where: { id: existing.id }, data: input })
      : this.prisma.productPricing.create({ data: { id: randomUUID(), ...input } });
  }
}
