import { PaymentProviderSessionStatus, PaymentProviderType } from '../../../../generated/prisma/enums';

export type HostedPaymentSessionInput = {
  orderId: string;
  paymentId: string;
  amount: string;
  currency: string;
  returnUrl: string;
  cancelUrl?: string;
};

export type HostedPaymentSessionResult = {
  provider: PaymentProviderType;
  providerSessionId: string;
  status: PaymentProviderSessionStatus;
  paymentUrl: string | null;
  returnUrl: string;
  cancelUrl: string | null;
  expiresAt?: Date | null;
  callbackData?: Record<string, unknown>;
};

export interface PaymentProviderAdapter {
  readonly type: PaymentProviderType;
  createHostedSession(
    input: HostedPaymentSessionInput,
  ): Promise<HostedPaymentSessionResult>;
}
