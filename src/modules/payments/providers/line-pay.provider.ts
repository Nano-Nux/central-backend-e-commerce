import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PaymentProviderType } from '../../../../generated/prisma/enums';
import { AppConfigService } from '../../../infrastructure/config/config.service';
import {
  HostedPaymentSessionInput,
  HostedPaymentSessionResult,
  PaymentProviderAdapter,
} from './payment-provider.interface';

@Injectable()
export class LinePayProvider implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.LINE_PAY;

  constructor(private readonly configService: AppConfigService) {}

  isConfigured() {
    return this.configService.isLinePayEnabled();
  }

  async createHostedSession(
    _input: HostedPaymentSessionInput,
  ): Promise<HostedPaymentSessionResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('LINE Pay is not configured');
    }

    throw new ServiceUnavailableException(
      'LINE Pay hosted checkout is not available in this build',
    );
  }
}
