import { Injectable } from '@nestjs/common';

import {
  AppliedPricingRule,
  PricingCustomerType,
  PricingService,
  type ResolvePriceInput,
  type ResolvedPrice,
} from '../../pricing/pricing.service';

export {
  AppliedPricingRule,
  PricingCustomerType,
  type ResolvePriceInput,
  type ResolvedPrice,
};

@Injectable()
export class PricingRuleService {
  constructor(private readonly pricingService: PricingService) {}

  getCurrentPrice(productId: string) {
    return this.pricingService.getCurrentPrice(productId);
  }

  resolvePrice(input: ResolvePriceInput): Promise<ResolvedPrice> {
    return this.pricingService.resolvePrice(input);
  }
}
