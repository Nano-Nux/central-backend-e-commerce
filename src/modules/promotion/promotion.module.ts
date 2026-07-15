import { Module } from '@nestjs/common';
import { PromotionController } from './promotion.controller';
import { StoreVoucherController } from './store-voucher.controller';
import { PromotionRepository } from './promotion.repository';
import { PromotionService } from './promotion.service';

@Module({
  controllers: [PromotionController, StoreVoucherController],
  providers: [PromotionService, PromotionRepository],
  exports: [PromotionService, PromotionRepository],
})
export class PromotionModule {}
