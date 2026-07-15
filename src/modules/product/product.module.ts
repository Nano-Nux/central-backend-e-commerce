import { Module } from '@nestjs/common';

import { CategoryModule } from '../category/category.module';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';
import { PricingRuleService } from './pricing/pricing-rule.service';
import { ProductAttributesController } from './product-attributes.controller';
import { ProductAttributesService } from './product-attributes.service';
import { ProductController } from './product.controller';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';
import { VariantController } from './variant.controller';
import { VariantReadService } from './variant-read.service';
import { ProductPricingController } from './pricing.controller';

@Module({
  imports: [AuditModule, CategoryModule, PricingModule, InventoryModule],
  controllers: [
    ProductController,
    ProductAttributesController,
    VariantController,
    ProductPricingController,
  ],
  providers: [
    ProductService,
    ProductRepository,
    ProductAttributesService,
    PricingRuleService,
    VariantReadService,
  ],
  exports: [
    ProductService,
    ProductRepository,
    ProductAttributesService,
    PricingRuleService,
  ],
})
export class ProductModule {}
