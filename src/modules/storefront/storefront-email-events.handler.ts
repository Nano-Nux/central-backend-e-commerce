import { Injectable } from '@nestjs/common';

import { SystemEvents } from '../../common/constants/event.constants';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEvent } from '../../infrastructure/event-bus/domain-event';
import { EventProcessingMode } from '../../infrastructure/event-bus/event-handler.interface';
import { OrderEventPayload } from '../../infrastructure/event-bus/events/order-created.event';
import { PaymentRecordedEventPayload } from '../../infrastructure/event-bus/events/payment.events';
import { OnEvent } from '../../infrastructure/event-bus/on-event.decorator';
import { EmailService } from '../email/email.service';
import { MerchantPaymentConfigurationsService } from '../payments/merchant-payment-configurations.service';

@Injectable()
export class StorefrontEmailEventsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantPaymentConfigurationsService: MerchantPaymentConfigurationsService,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent(SystemEvents.ORDER_CREATED, {
    mode: EventProcessingMode.ASYNC,
    retries: 2,
    priority: 100,
  })
  async queueOrderConfirmation(event: DomainEvent<OrderEventPayload>) {
    if (event.payload.source !== 'ONLINE') {
      return;
    }

    const recipient = await this.resolveRecipient(event.payload.id);

    if (!recipient?.email) {
      return;
    }

    const orderContext = await this.loadOrderEmailContext(event.payload.id);

    await this.emailService.queueEmail({
      toEmail: recipient.email,
      subject: `Order confirmation ${event.payload.id}`,
      body: this.buildOrderConfirmationEmail({
        recipientName: recipient.name,
        orderId: event.payload.id,
        total: event.payload.total,
        currency: event.payload.currency,
        status: event.payload.status,
        orderNotes: orderContext?.orderNotes ?? null,
        paymentReference: orderContext?.paymentReference ?? null,
        paymentMethod: orderContext?.paymentMethod ?? null,
        qrImageUrl: orderContext?.qrImageUrl ?? null,
        paymentInstructions: orderContext?.paymentInstructions ?? null,
        uploadProofUrl: orderContext?.uploadProofUrl ?? null,
      }),
    });
  }

  @OnEvent(SystemEvents.PAYMENT_SUCCEEDED, {
    mode: EventProcessingMode.ASYNC,
    retries: 2,
    priority: 100,
  })
  async queuePaymentConfirmation(
    event: DomainEvent<PaymentRecordedEventPayload>,
  ) {
    if (
      !event.payload.orderFullyPaid ||
      event.payload.order.source !== 'ONLINE'
    ) {
      return;
    }

    const recipient = await this.resolveRecipient(event.payload.order.id);

    if (!recipient?.email) {
      return;
    }

    await this.emailService.queueEmail({
      toEmail: recipient.email,
      subject: `Payment confirmation ${event.payload.order.id}`,
      body:
        `Hello ${recipient.name ?? 'Customer'},\n\n` +
        `We have received your payment for order ${event.payload.order.id}.\n` +
        `Paid amount: ${event.payload.payment.amount} ${event.payload.order.currency}\n` +
        `Payment method: ${event.payload.payment.method}\n\n` +
        `Thank you for your purchase.`,
    });
  }

  private async resolveRecipient(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        contactName: true,
        contactEmail: true,
        guestName: true,
        guestEmail: true,
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return {
      name:
        order.contactName ?? order.guestName ?? order.customer?.name ?? null,
      email:
        order.contactEmail ?? order.guestEmail ?? order.customer?.email ?? null,
    };
  }

  private async loadOrderEmailContext(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNotes: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            method: true,
            reference: true,
            verificationContextJson: true,
            merchantPaymentConfiguration: {
              select: {
                providerName: true,
                accountName: true,
                accountNumber: true,
                qrImageBucket: true,
                qrImageObjectName: true,
              },
            },
          },
        },
      },
    });

    const payment = order?.payments[0];

    if (!order || !payment) {
      return null;
    }

    const verificationContext = this.toRecord(payment.verificationContextJson);
    const proofUpload = this.toRecord(verificationContext?.proofUpload);
    const merchantConfiguration = payment.merchantPaymentConfiguration;
    const qrImageUrl = merchantConfiguration
      ? await this.merchantPaymentConfigurationsService.getQrImageUrl(
          merchantConfiguration.qrImageBucket,
          merchantConfiguration.qrImageObjectName,
        )
      : null;

    return {
      orderNotes: order.orderNotes ?? null,
      paymentMethod: payment.method,
      paymentReference: payment.reference ?? null,
      uploadProofUrl:
        typeof proofUpload?.url === 'string' ? proofUpload.url : null,
      qrImageUrl,
      paymentInstructions:
        payment.method === 'QR_MANUAL' && merchantConfiguration
          ? `Transfer to ${merchantConfiguration.providerName} (${merchantConfiguration.accountName} / ${merchantConfiguration.accountNumber}) and upload your receipt for manual verification.`
          : null,
    };
  }

  private buildOrderConfirmationEmail(input: {
    recipientName: string | null;
    orderId: string;
    total: string;
    currency: string;
    status: string;
    orderNotes: string | null;
    paymentReference: string | null;
    paymentMethod: string | null;
    qrImageUrl: string | null;
    paymentInstructions: string | null;
    uploadProofUrl: string | null;
  }) {
    const lines = [
      `Hello ${input.recipientName ?? 'Customer'},`,
      '',
      `Your order ${input.orderId} has been received.`,
      `Order amount: ${input.total} ${input.currency}`,
      `Status: ${input.status}`,
      `Customer note/reference: ${input.orderNotes ?? '-'}`,
    ];

    if (input.paymentReference) {
      lines.push(`Payment reference: ${input.paymentReference}`);
    }

    if (input.paymentMethod === 'QR_MANUAL') {
      lines.push('');
      lines.push('QR manual payment instructions:');
      lines.push(
        input.paymentInstructions ??
          'Upload your bank transfer receipt after payment.',
      );

      if (input.qrImageUrl) {
        lines.push(`QR image: ${input.qrImageUrl}`);
      }

      if (input.uploadProofUrl) {
        lines.push(`Upload payment proof: ${input.uploadProofUrl}`);
      }
    } else {
      lines.push('');
      lines.push('We will notify you again once the payment is completed.');
    }

    lines.push('');
    lines.push('Thank you for shopping with us.');

    return lines.join('\n');
  }

  private toRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}
