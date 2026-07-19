import { Module } from '@nestjs/common';

import { CommunicationModule } from '../communication/communication.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { PricingModule } from '../pricing/pricing.module';
import { StoreAccountController } from './store-account.controller';
import { StoreAccountService } from './store-account.service';
import { StoreCartController } from './store-cart.controller';
import { StoreCartService } from './store-cart.service';
import { StoreCatalogController } from './store-catalog.controller';
import { StoreCatalogService } from './store-catalog.service';
import { GuestOrderAccessGuard } from './guest-order-access.guard';
import { StoreGuestOrdersController } from './store-guest-orders.controller';
import { StoreGuestOrdersService } from './store-guest-orders.service';
import { AuthModule } from '../auth/auth.module';
import { StorePaymentsController } from './store-payments.controller';
import { StorePaymentsService } from './store-payments.service';
import { StorefrontEmailEventsHandler } from './storefront-email-events.handler';
import { StorefrontTelegramEventsHandler } from './storefront-telegram-events.handler';
import { StoreAuthController } from './store-auth.controller';
import { BrandModule } from '../brand/brand.module';
import { BannerImageModule } from '../banner-image/banner-image.module';
import { MinioModule } from '../../infrastructure/minio/minio.module';

@Module({
  imports: [
    AuthModule,
    BrandModule,
    BannerImageModule,
    CommunicationModule,
    InventoryModule,
    MinioModule,
    OrdersModule,
    PaymentsModule,
    PricingModule,
  ],
  controllers: [
    StoreCatalogController,
    StoreAccountController,
    StoreGuestOrdersController,
    StoreCartController,
    StorePaymentsController,
    StoreAuthController,
  ],
  providers: [
    StoreCatalogService,
    StoreAccountService,
    StoreGuestOrdersService,
    StoreCartService,
    StorePaymentsService,
    StorefrontEmailEventsHandler,
    StorefrontTelegramEventsHandler,
    GuestOrderAccessGuard,
  ],
  exports: [StoreAccountService, StoreGuestOrdersService],
})
export class StorefrontModule {}
