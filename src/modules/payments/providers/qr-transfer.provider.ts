import { BadRequestException, Injectable } from '@nestjs/common';

import { PaymentProviderType } from '../../../../generated/prisma/enums';
import {
  HostedPaymentSessionInput,
  HostedPaymentSessionResult,
  PaymentProviderAdapter,
} from './payment-provider.interface';

@Injectable()
export class QrTransferProvider implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.QR_TRANSFER;

  async createHostedSession(
    _input: HostedPaymentSessionInput,
  ): Promise<HostedPaymentSessionResult> {
    throw new BadRequestException(
      'QR transfer does not support hosted payment sessions',
    );
  }
}
