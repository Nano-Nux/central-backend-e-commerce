import { BadRequestException, Injectable } from '@nestjs/common';

import { PaymentProviderType } from '../../../../generated/prisma/enums';
import {
  HostedPaymentSessionInput,
  HostedPaymentSessionResult,
  PaymentProviderAdapter,
} from './payment-provider.interface';

@Injectable()
export class ManualTransferProvider implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.MANUAL_TRANSFER;

  async createHostedSession(
    _input: HostedPaymentSessionInput,
  ): Promise<HostedPaymentSessionResult> {
    throw new BadRequestException(
      'Manual transfer does not support hosted payment sessions',
    );
  }
}
