import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import {
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import {
  normalizeEmail,
  sanitizeOptionalPlainText,
  sanitizePlainText,
} from '../../common/utils/input-sanitizer.util';
import { AppConfigService } from '../../infrastructure/config/config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditContext } from '../audit/audit.service';
import { MerchantPaymentConfigurationsService } from '../payments/merchant-payment-configurations.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingCustomerType } from '../pricing/pricing.service';
import { StoreCheckoutDto } from '../shared/dto/store-checkout.dto';
import { UsersRepository } from '../users/users.repository';
import { OrdersService } from './orders.service';
import { PromotionService } from '../promotion/promotion.service';

@Injectable()
export class StoreCheckoutService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly appConfigService: AppConfigService,
    private readonly merchantPaymentConfigurationsService: MerchantPaymentConfigurationsService,
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly promotionService: PromotionService,
  ) {}

  async checkout(dto: StoreCheckoutDto, context?: AuditContext) {
    return this.prisma.$transaction(async (transaction) => {
    const checkoutIdentity = context?.actorId
      ? await this.resolveCheckoutIdentityForUser(context.actorId, transaction)
      : null;
    const customerId = checkoutIdentity?.customerId ?? null;
    const orderNotes = this.requireSanitizedText(
      dto.orderNotes,
      'Order notes are required',
    );
    const guestEmail = customerId ? undefined : normalizeEmail(dto.guestEmail);

    if (!customerId && !guestEmail) {
      throw new BadRequestException('Guest email is required');
    }

    const contactEmail =
      checkoutIdentity?.user.email.toLowerCase() ??
      normalizeEmail(dto.contactEmail) ??
      guestEmail;
    const contactName =
      sanitizeOptionalPlainText(dto.contactName) ??
      checkoutIdentity?.user.name ??
      sanitizeOptionalPlainText(dto.guestName);
    const contactPhone =
      sanitizeOptionalPlainText(dto.contactPhone) ??
      sanitizeOptionalPlainText(dto.guestPhone);
    const paymentStatus =
      dto.paymentMethod === PaymentMethod.QR_MANUAL
        ? PaymentStatus.AWAITING_VERIFICATION
        : dto.paymentMethod === PaymentMethod.ONLINE
          ? PaymentStatus.PENDING
          : PaymentStatus.SUCCESS;
    const merchantConfiguration =
      dto.paymentMethod === PaymentMethod.QR_MANUAL
        ? await this.merchantPaymentConfigurationsService.resolveActiveConfiguration()
        : null;

    if (
      dto.paymentMethod === PaymentMethod.QR_MANUAL &&
      !merchantConfiguration
    ) {
      throw new BadRequestException(
        'QR manual payment is not available right now',
      );
    }

    const createOrderInput = {
      idempotencyKey: dto.idempotencyKey,
      customerId,
      customerType: customerId
        ? PricingCustomerType.MEMBER
        : PricingCustomerType.RETAIL,
      items: dto.items,
    };

      const promotion = dto.voucherCode
        ? await this.promotionService.validate({
            code: dto.voucherCode,
            cartTotal: Number((await this.ordersService.calculateSubtotal(
              dto.items,
              createOrderInput.customerType,
            )).toString()),
          })
        : null;
      createOrderInput['discount'] = promotion ? Number(promotion.discountAmount) : 0;

      const order = await this.ordersService.create(
        createOrderInput,
        context,
        {
          orderType: customerId ? OrderType.CUSTOMER : OrderType.GUEST,
          requestKey: dto.idempotencyKey ?? dto.paymentReference ?? undefined,
          guest: customerId
            ? undefined
            : {
                name: sanitizeOptionalPlainText(dto.guestName),
                email: guestEmail,
                phone: sanitizeOptionalPlainText(dto.guestPhone),
              },
          contact: {
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
          },
          shippingAddress: dto.shippingAddress as
            | Prisma.InputJsonValue
            | undefined,
          billingAddress: dto.billingAddress as Prisma.InputJsonValue | undefined,
          orderNotes,
        },
        transaction,
      );

      if (promotion) await this.promotionService.consume(promotion.voucherId, transaction);

      const payment = await this.paymentsService.recordPayment(
        {
          orderId: order.id,
          method: dto.paymentMethod,
          amount: dto.paymentAmount ?? Number(order.total.toString()),
          status: paymentStatus,
          reference:
            dto.paymentReference ??
            (dto.paymentMethod === PaymentMethod.QR_MANUAL
              ? `qr-manual:${order.id}`
              : undefined),
          idempotencyKey:
            dto.paymentReference ??
            `store-checkout:${order.id}:${context?.actorId ?? 'guest'}`,
        },
        context,
        transaction,
      );

      const guestAccess =
        !customerId && guestEmail
          ? await this.issueGuestAccessToken(guestEmail, transaction)
          : null;
      const uploadProofUrl =
        dto.paymentMethod === PaymentMethod.QR_MANUAL
          ? this.buildUploadProofUrl(order.id, !customerId)
          : null;
      const verificationContext = {
        customerNote: orderNotes,
        orderId: order.id,
        paymentMethod: dto.paymentMethod,
        paymentReference: payment.reference ?? dto.paymentReference ?? null,
        customerContact: {
          name: contactName ?? null,
          email: contactEmail ?? null,
          phone: contactPhone ?? null,
        },
        proofUpload: uploadProofUrl ? { url: uploadProofUrl } : null,
        merchantConfiguration: merchantConfiguration
          ? {
              id: merchantConfiguration.id,
              providerName: merchantConfiguration.providerName,
              countryCode: merchantConfiguration.countryCode,
              accountName: merchantConfiguration.accountName,
              accountNumber: merchantConfiguration.accountNumber,
              qrImageUrl: merchantConfiguration.qrImageUrl,
            }
          : null,
      };
      const updatedPayment = await transaction.payment.update({
        where: { id: payment.id },
        data: {
          merchantPaymentConfigurationId: merchantConfiguration?.id ?? null,
          verificationContextJson: verificationContext as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          method: true,
          amount: true,
          status: true,
          reference: true,
        },
      });

      return {
        order,
        payment: updatedPayment,
        manualPayment:
          merchantConfiguration && uploadProofUrl
            ? {
                providerName: merchantConfiguration.providerName,
                countryCode: merchantConfiguration.countryCode,
                accountName: merchantConfiguration.accountName,
                accountNumber: merchantConfiguration.accountNumber,
                qrImageUrl: merchantConfiguration.qrImageUrl,
                paymentInstructions:
                  `Transfer the exact order amount to ${merchantConfiguration.providerName} ` +
                  `and upload your payment proof for manual verification.`,
                uploadProofUrl,
              }
            : undefined,
        accessToken: guestAccess?.accessToken ?? null,
        guestAccessToken: guestAccess?.accessToken ?? null,
        guest: {
          name: order.guestName ?? null,
          email: order.guestEmail ?? null,
          phone: order.guestPhone ?? null,
        },
      };
    });
  }

  private async resolveCheckoutIdentityForUser(
    userId: string,
    transaction: Prisma.TransactionClient,
  ) {
      await transaction.$queryRaw`
        SELECT id
        FROM users
        WHERE id = ${userId}
        FOR UPDATE
      `;

      const existingCustomer = await transaction.customer.findFirst({
        where: { userId },
        select: { id: true },
      });

      if (existingCustomer) {
        const user = await this.usersRepository.findIdentityById(userId);

        if (!user) {
          return null;
        }

        return {
          customerId: existingCustomer.id,
          user,
        };
      }

      const user = await this.usersRepository.findIdentityById(userId);

      if (!user) {
        return null;
      }

      const customer = await transaction.customer.create({
        data: {
          name: sanitizePlainText(user.name),
          email: normalizeEmail(user.email) ?? user.email,
          userId: user.id,
        },
        select: { id: true },
      });

      return {
        customerId: customer.id,
        user,
      };
  }

  private buildUploadProofUrl(orderId: string, isGuestOrder: boolean) {
    const apiBaseUrl = this.appConfigService.getApiBaseUrl();

    if (isGuestOrder) {
      return `${apiBaseUrl}/store/guest-orders/${orderId}/payment-proofs`;
    }

    return `${apiBaseUrl}/store/me/orders/${orderId}/payment-proofs`;
  }

  private async issueGuestAccessToken(
    email: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const accessToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await (transaction ?? this.prisma).guestOrderAccessToken.create({
      data: {
        email,
        tokenHash: createHash('sha256').update(accessToken).digest('hex'),
        expiresAt,
      },
    });

    return {
      accessToken,
      expiresAt,
    };
  }

  private requireSanitizedText(value: string | undefined, message: string) {
    const normalized = value ? sanitizePlainText(value) : '';

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }
}
