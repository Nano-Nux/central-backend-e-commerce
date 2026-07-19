import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfigModule } from './infrastructure/config/config.module';
import { validateEnv } from './infrastructure/config/config.service';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandModule } from './modules/brand/brand.module';
import { BannerImageModule } from './modules/banner-image/banner-image.module';
import { CategoryModule } from './modules/category/category.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { CrmModule } from './modules/crm/crm.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { POSModule } from './modules/pos/pos.module';
import { ProductModule } from './modules/product/product.module';
import { PromotionModule } from './modules/promotion/promotion.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { UsersModule } from './modules/users/users.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    AppConfigModule,
    EventBusModule,
    MinioModule,
    SettingsModule,
    WebhooksModule,
    TicketsModule,
    PrismaModule,
    AccountingModule,
    AiGatewayModule,
    AuditModule,
    AuthModule,
    BrandModule,
    BannerImageModule,
    CategoryModule,
    CommunicationModule,
    CrmModule,
    InventoryModule,
    OrdersModule,
    PaymentsModule,
    POSModule,
    ProductModule,
    PromotionModule,
    PurchaseModule,
    ReconciliationModule,
    StorefrontModule,
    UsersModule,
    WorkflowModule,
    TestimonialsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
