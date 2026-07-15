import { Injectable, NotFoundException } from '@nestjs/common';

import { PaymentProviderType } from '../../../generated/prisma/enums';
import { LinePayProvider } from './providers/line-pay.provider';
import { ManualTransferProvider } from './providers/manual-transfer.provider';
import { PaymentProviderAdapter } from './providers/payment-provider.interface';
import { QrTransferProvider } from './providers/qr-transfer.provider';

@Injectable()
export class PaymentProviderRegistryService {
  private readonly providers: Map<PaymentProviderType, PaymentProviderAdapter>;

  constructor(
    linePayProvider: LinePayProvider,
    manualTransferProvider: ManualTransferProvider,
    qrTransferProvider: QrTransferProvider,
  ) {
    this.providers = new Map(
      [
        linePayProvider,
        manualTransferProvider,
        qrTransferProvider,
      ].map((provider) => [provider.type, provider]),
    );
  }

  get(type: PaymentProviderType) {
    const provider = this.providers.get(type);

    if (!provider) {
      throw new NotFoundException(`Payment provider ${type} is not configured`);
    }

    return provider;
  }
}
