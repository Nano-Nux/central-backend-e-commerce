import { Injectable, NotFoundException } from '@nestjs/common';

import { PaymentMethod } from '../../../generated/prisma/enums';
import { AppConfigService } from '../../infrastructure/config/config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditContext } from '../audit/audit.service';
import { MerchantPaymentConfigurationsService } from '../payments/merchant-payment-configurations.service';
import { PaymentProofsService } from '../payments/payment-proofs.service';
import { PaymentProviderSessionsService } from '../payments/payment-provider-sessions.service';
import { StoreAccountService } from './store-account.service';
import { StoreGuestOrdersService } from './store-guest-orders.service';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
};

@Injectable()
export class StorePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfigService: AppConfigService,
    private readonly storeAccountService: StoreAccountService,
    private readonly storeGuestOrdersService: StoreGuestOrdersService,
    private readonly merchantPaymentConfigurationsService: MerchantPaymentConfigurationsService,
    private readonly paymentProofsService: PaymentProofsService,
    private readonly paymentProviderSessionsService: PaymentProviderSessionsService,
  ) {}

  async listEnabledPaymentMethods() {
    const methods: Array<{
      code: PaymentMethod;
      displayName: string;
      description?: string;
    }> = [];

    const merchantConfiguration =
      await this.merchantPaymentConfigurationsService.resolveActiveConfiguration();

    if (merchantConfiguration) {
      methods.push({
        code: PaymentMethod.QR_MANUAL,
        displayName: 'QR Manual',
        description: `Manual verification via ${this.displayMerchantProvider(merchantConfiguration.providerName)}`,
      });
    }

    if (await this.isLinePayAvailable()) {
      methods.push({
        code: PaymentMethod.ONLINE,
        displayName: 'LINE Pay',
        description: 'Hosted LINE Pay payment session',
      });
    }

    return methods;
  }

  private displayMerchantProvider(providerName: string) {
    switch (providerName) {
      case 'TH_PROMPTPAY':
        return 'Thai PromptPay';
      case 'MM_KBZPAY':
        return 'KBZPay';
      case 'MM_WAVEPAY':
        return 'WavePay';
      default:
        return providerName;
    }
  }

  private async isLinePayAvailable() {
    void this.appConfigService;

    // LINE Pay credentials may exist, but hosted checkout is intentionally gated
    // until a real provider integration replaces the placeholder foundation flow.
    return false;
  }

  async uploadProofForCustomer(
    userId: string,
    orderId: string,
    input: { paymentId?: string; file: UploadedFile },
  ) {
    const customer =
      await this.storeAccountService.ensureCustomerForUser(userId);
    await this.ensureCustomerOrder(customer.id, orderId);

    return this.paymentProofsService.uploadProofForOrder(orderId, {
      paymentId: input.paymentId,
      uploadedByUserId: userId,
      file: input.file,
    });
  }

  async uploadProofForGuest(
    guestEmail: string,
    orderId: string,
    input: { paymentId?: string; file: UploadedFile },
  ) {
    await this.ensureGuestOrder(guestEmail, orderId);

    return this.paymentProofsService.uploadProofForOrder(orderId, {
      paymentId: input.paymentId,
      file: input.file,
    });
  }

  async createLinePaySessionForCustomer(
    userId: string,
    orderId: string,
    input: { paymentId?: string; returnUrl: string; cancelUrl?: string },
  ) {
    const customer =
      await this.storeAccountService.ensureCustomerForUser(userId);
    await this.ensureCustomerOrder(customer.id, orderId);

    return this.paymentProviderSessionsService.createLinePaySession({
      orderId,
      paymentId: input.paymentId,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
    });
  }

  async createLinePaySessionForGuest(
    guestEmail: string,
    orderId: string,
    input: { paymentId?: string; returnUrl: string; cancelUrl?: string },
  ) {
    await this.ensureGuestOrder(guestEmail, orderId);

    return this.paymentProviderSessionsService.createLinePaySession({
      orderId,
      paymentId: input.paymentId,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
    });
  }

  async confirmLinePaySessionForCustomer(
    userId: string,
    orderId: string,
    providerSessionId: string,
    context?: AuditContext,
  ) {
    const customer =
      await this.storeAccountService.ensureCustomerForUser(userId);
    await this.ensureCustomerOrder(customer.id, orderId);
    await this.ensureProviderSessionOrder(orderId, providerSessionId);

    return this.paymentProviderSessionsService.confirmLinePaySession(
      providerSessionId,
      context,
    );
  }

  async confirmLinePaySessionForGuest(
    guestEmail: string,
    orderId: string,
    providerSessionId: string,
    context?: AuditContext,
  ) {
    await this.ensureGuestOrder(guestEmail, orderId);
    await this.ensureProviderSessionOrder(orderId, providerSessionId);

    return this.paymentProviderSessionsService.confirmLinePaySession(
      providerSessionId,
      context,
    );
  }

  async handleLinePayReturn(input: {
    providerSessionId: string;
    transactionId?: string;
  }) {
    return this.paymentProviderSessionsService.handleLinePayReturnCallback(
      input,
    );
  }

  async handleLinePayWebhook(
    input: { providerSessionId: string; transactionId?: string },
    context?: AuditContext,
  ) {
    return this.paymentProviderSessionsService.handleLinePayWebhook(
      input,
      context,
    );
  }

  private async ensureCustomerOrder(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
      },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
  }

  private async ensureGuestOrder(guestEmail: string, orderId: string) {
    const normalizedEmail = guestEmail.trim().toLowerCase();
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        guestEmail: normalizedEmail,
      },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
  }

  private async ensureProviderSessionOrder(
    orderId: string,
    providerSessionId: string,
  ) {
    const session = await this.prisma.paymentProviderSession.findUnique({
      where: { providerSessionId },
      select: { orderId: true },
    });

    if (!session || session.orderId !== orderId) {
      throw new NotFoundException('Payment provider session not found');
    }
  }
}
