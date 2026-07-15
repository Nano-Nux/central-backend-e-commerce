import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { MinioModule } from '../../infrastructure/minio/minio.module';
import { MerchantPaymentConfigurationsService } from './merchant-payment-configurations.service';
import { PaymentProofsService } from './payment-proofs.service';
import { PaymentProviderRegistryService } from './payment-provider-registry.service';
import { PaymentProviderSessionsService } from './payment-provider-sessions.service';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { LinePayProvider } from './providers/line-pay.provider';
import { ManualTransferProvider } from './providers/manual-transfer.provider';
import { QrTransferProvider } from './providers/qr-transfer.provider';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuditModule, MinioModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    MerchantPaymentConfigurationsService,
    PaymentProofsService,
    PaymentProviderSessionsService,
    PaymentProviderRegistryService,
    LinePayProvider,
    ManualTransferProvider,
    QrTransferProvider,
  ],
  exports: [
    PaymentsService,
    MerchantPaymentConfigurationsService,
    PaymentProofsService,
    PaymentProviderSessionsService,
  ],
})
export class PaymentsModule {}
