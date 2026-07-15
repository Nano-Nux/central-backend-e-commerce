import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PricingRepository } from './pricing.repository';

export enum PricingCustomerType {
  RETAIL = 'RETAIL',
  MEMBER = 'MEMBER',
  WHOLESALE = 'WHOLESALE',
}

export enum AppliedPricingRule {
  PROMOTION = 'PROMOTION',
  MEMBER = 'MEMBER',
  WHOLESALE = 'WHOLESALE',
  SELLING = 'SELLING',
}

export type ResolvePriceInput = {
  productId: string;
  variantId?: string | null;
  customerType: PricingCustomerType;
  currentDate: Date;
};

export type ResolvedPrice = {
  finalPrice: Prisma.Decimal;
  appliedRule: AppliedPricingRule;
  basePrice: Prisma.Decimal;
};

type ProductPriceRecord = Awaited<
  ReturnType<PricingRepository['findByProduct']>
>;

@Injectable()
export class PricingService {
  constructor(private readonly pricingRepository: PricingRepository) {}

  async getCurrentPrice(productId: string): Promise<ResolvedPrice> {
    return this.resolvePrice({
      productId,
      customerType: PricingCustomerType.RETAIL,
      currentDate: new Date(),
    });
  }

  async setPrice(input: {
    productId: string;
    variantId?: string | null;
    costPrice: string | number;
    sellingPrice: string | number;
    wholesalePrice?: string | number | null;
    memberPrice?: string | number | null;
    promotionPrice?: string | number | null;
    promotionStartAt?: string | null;
    promotionEndAt?: string | null;
  }) {
    const decimal = (value: string | number | null | undefined) =>
      value === null || value === undefined ? null : new Prisma.Decimal(value);
    return this.pricingRepository.upsert({
      productId: input.productId,
      variantId: input.variantId,
      costPrice: new Prisma.Decimal(input.costPrice),
      sellingPrice: new Prisma.Decimal(input.sellingPrice),
      wholesalePrice: decimal(input.wholesalePrice),
      memberPrice: decimal(input.memberPrice),
      promotionPrice: decimal(input.promotionPrice),
      promotionStartAt: input.promotionStartAt ? new Date(input.promotionStartAt) : null,
      promotionEndAt: input.promotionEndAt ? new Date(input.promotionEndAt) : null,
    });
  }

  async resolvePrice(input: ResolvePriceInput): Promise<ResolvedPrice> {
    const price = await this.pricingRepository.findByProduct(
      input.productId,
      input.variantId,
    );

    if (!price) {
      throw new BadRequestException('Product price is not configured');
    }

    if (this.isPromotionActive(price, input.currentDate)) {
      return {
        finalPrice: price.promotionPrice!,
        appliedRule: AppliedPricingRule.PROMOTION,
        basePrice: price.sellingPrice,
      };
    }

    if (
      input.customerType === PricingCustomerType.MEMBER &&
      price.memberPrice
    ) {
      return {
        finalPrice: price.memberPrice,
        appliedRule: AppliedPricingRule.MEMBER,
        basePrice: price.sellingPrice,
      };
    }

    if (
      input.customerType === PricingCustomerType.WHOLESALE &&
      price.wholesalePrice
    ) {
      return {
        finalPrice: price.wholesalePrice,
        appliedRule: AppliedPricingRule.WHOLESALE,
        basePrice: price.sellingPrice,
      };
    }

    return {
      finalPrice: price.sellingPrice,
      appliedRule: AppliedPricingRule.SELLING,
      basePrice: price.sellingPrice,
    };
  }

  private isPromotionActive(
    price: NonNullable<ProductPriceRecord>,
    currentDate: Date,
  ) {
    return (
      Boolean(price.promotionPrice) &&
      (!price.promotionStartAt || price.promotionStartAt <= currentDate) &&
      (!price.promotionEndAt || price.promotionEndAt >= currentDate)
    );
  }
}
