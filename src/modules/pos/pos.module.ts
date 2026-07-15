import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { POSController } from './pos.controller';
import { POSService } from './pos.service';

@Module({
  imports: [AuditModule, OrdersModule, PaymentsModule],
  controllers: [POSController],
  providers: [POSService],
})
export class POSModule {}
