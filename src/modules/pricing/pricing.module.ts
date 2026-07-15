import { Module } from '@nestjs/common';

import { PricingRepository } from './pricing.repository';
import { PricingService } from './pricing.service';

@Module({
  providers: [PricingService, PricingRepository],
  exports: [PricingService, PricingRepository],
})
export class PricingModule {}
