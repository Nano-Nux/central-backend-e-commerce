import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersRepository } from '../customers/customers.repository';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { UsersRepository } from '../users/users.repository';
import { OrdersController } from './orders.controller';
import { OrdersPaymentEventsHandler } from './orders-payment-events.handler';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { StoreController } from './store.controller';
import { StoreCheckoutService } from './store-checkout.service';
import { PromotionModule } from '../promotion/promotion.module';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    PricingModule,
    PaymentsModule,
    InventoryModule,
    PromotionModule,
  ],
  controllers: [OrdersController, StoreController],
  providers: [
    OrdersService,
    OrdersRepository,
    UsersRepository,
    CustomersRepository,
    OrdersPaymentEventsHandler,
    StoreCheckoutService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
