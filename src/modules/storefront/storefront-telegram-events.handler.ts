import { Injectable } from '@nestjs/common';

import { SystemEvents } from '../../common/constants/event.constants';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEvent } from '../../infrastructure/event-bus/domain-event';
import { EventProcessingMode } from '../../infrastructure/event-bus/event-handler.interface';
import { OrderEventPayload } from '../../infrastructure/event-bus/events/order-created.event';
import { PaymentRecordedEventPayload } from '../../infrastructure/event-bus/events/payment.events';
import { OnEvent } from '../../infrastructure/event-bus/on-event.decorator';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { TelegramService } from '../communication/telegram.service';

@Injectable()
export class StorefrontTelegramEventsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly minioService: MinioService,
  ) {}

  @OnEvent(SystemEvents.ORDER_CREATED, {
    mode: EventProcessingMode.ASYNC,
    retries: 2,
    priority: 100,
  })
  async sendOrderToTelegram(event: DomainEvent<OrderEventPayload>) {
    if (event.payload.source !== 'ONLINE') {
      return;
    }

    const orderContext = await this.loadOrderContext(event.payload.id);

    const lines: string[] = [
      `<b>🛒 New Order</b>`,
      ``,
      `<b>Order ID:</b> <code>${event.payload.id}</code>`,
      `<b>Status:</b> ${event.payload.status}`,
      `<b>Total:</b> ${event.payload.total} ${event.payload.currency}`,
      `<b>Subtotal:</b> ${event.payload.subtotal} ${event.payload.currency}`,
      `<b>Discount:</b> ${event.payload.discount} ${event.payload.currency}`,
      `<b>Tax:</b> ${event.payload.tax} ${event.payload.currency}`,
    ];

    const customerName = event.payload.guestName ?? orderContext?.customerName ?? '-';
    const customerEmail = event.payload.guestEmail ?? orderContext?.customerEmail ?? '-';
    const customerPhone = event.payload.guestPhone ?? '-';

    lines.push(``);
    lines.push(`<b>Customer:</b>`);
    lines.push(`Name: ${this.escapeHtml(customerName)}`);
    lines.push(`Email: ${this.escapeHtml(customerEmail)}`);
    lines.push(`Phone: ${this.escapeHtml(customerPhone)}`);

    if (orderContext?.contactName || orderContext?.contactEmail || orderContext?.contactPhone) {
      lines.push(``);
      lines.push(`<b>Contact:</b>`);
      if (orderContext.contactName) lines.push(`Name: ${this.escapeHtml(orderContext.contactName)}`);
      if (orderContext.contactEmail) lines.push(`Email: ${this.escapeHtml(orderContext.contactEmail)}`);
      if (orderContext.contactPhone) lines.push(`Phone: ${this.escapeHtml(orderContext.contactPhone)}`);
    }

    if (event.payload.items?.length) {
      lines.push(``);
      lines.push(`<b>Items:</b>`);
      for (const item of event.payload.items) {
        lines.push(
          `• ${item.quantity}x Product ${item.productId} — ${item.totalPrice} ${event.payload.currency}`,
        );
      }
    }

    if (orderContext?.orderNotes) {
      lines.push(``);
      lines.push(`<b>Order Notes:</b> ${this.escapeHtml(orderContext.orderNotes)}`);
    }

    if (orderContext?.paymentMethod) {
      lines.push(``);
      lines.push(`<b>Payment:</b>`);
      lines.push(`Method: ${orderContext.paymentMethod}`);
      if (orderContext.paymentReference) {
        lines.push(`Reference: ${orderContext.paymentReference}`);
      }
    }

    if (orderContext?.merchantConfiguration) {
      const mc = orderContext.merchantConfiguration;
      lines.push(``);
      lines.push(`<b>Bank Transfer Details:</b>`);
      lines.push(`Provider: ${mc.providerName}`);
      lines.push(`Account: ${mc.accountName} / ${mc.accountNumber}`);
      if (mc.qrImageUrl) {
        lines.push(`QR: ${mc.qrImageUrl}`);
      }
    }

    if (orderContext?.uploadProofUrl) {
      lines.push(``);
      lines.push(`<b>Upload Proof URL:</b>`);
      lines.push(orderContext.uploadProofUrl);
    }

    if (orderContext?.shippingAddress) {
      lines.push(``);
      lines.push(`<b>Shipping Address:</b>`);
      lines.push(this.formatAddress(orderContext.shippingAddress));
    }

    await this.telegramService.sendMessage(lines.join('\n'));
  }

  @OnEvent(SystemEvents.PAYMENT_SUCCEEDED, {
    mode: EventProcessingMode.ASYNC,
    retries: 2,
    priority: 100,
  })
  async sendPaymentToTelegram(event: DomainEvent<PaymentRecordedEventPayload>) {
    if (!event.payload.orderFullyPaid || event.payload.order.source !== 'ONLINE') {
      return;
    }

    const lines: string[] = [
      `<b>✅ Payment Received</b>`,
      ``,
      `<b>Order ID:</b> <code>${event.payload.order.id}</code>`,
      `<b>Amount:</b> ${event.payload.payment.amount} ${event.payload.order.currency}`,
      `<b>Method:</b> ${event.payload.payment.method}`,
      `<b>Reference:</b> ${event.payload.payment.reference ?? '-'}`,
    ];

    const customerName = event.payload.order.guestName ?? '-';
    const customerEmail = event.payload.order.guestEmail ?? '-';
    const customerPhone = event.payload.order.guestPhone ?? '-';

    lines.push(``);
    lines.push(`<b>Customer:</b>`);
    lines.push(`Name: ${this.escapeHtml(customerName)}`);
    lines.push(`Email: ${this.escapeHtml(customerEmail)}`);
    lines.push(`Phone: ${this.escapeHtml(customerPhone)}`);

    await this.telegramService.sendMessage(lines.join('\n'));

    const proofUrl = await this.getPaymentProofUrl(event.payload.payment.id);
    if (proofUrl) {
      await this.telegramService.sendPhoto(
        proofUrl,
        `Payment proof for order ${event.payload.order.id}`,
      );
    }
  }

  private async getPaymentProofUrl(paymentId: string) {
    const proof = await this.prisma.paymentProof.findFirst({
      where: { paymentId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: { bucket: true, objectName: true },
    });

    if (!proof) return null;

    try {
      return await this.minioService.getSignedUrl(proof.bucket, proof.objectName);
    } catch {
      return null;
    }
  }

  private async loadOrderContext(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNotes: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        customer: {
          select: { name: true, email: true },
        },
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

    if (!order) return null;

    const payment = order.payments?.[0];
    const verificationContext = this.toRecord(payment?.verificationContextJson);
    const proofUpload = this.toRecord(verificationContext?.proofUpload);
    const merchantConfiguration = payment?.merchantPaymentConfiguration;
    let qrImageUrl: string | null = null;

    if (merchantConfiguration?.qrImageBucket && merchantConfiguration?.qrImageObjectName) {
      try {
        qrImageUrl = await this.minioService.getSignedUrl(
          merchantConfiguration.qrImageBucket,
          merchantConfiguration.qrImageObjectName,
        );
      } catch {}
    }

    return {
      orderNotes: order.orderNotes ?? null,
      customerName: order.customer?.name ?? null,
      customerEmail: order.customer?.email ?? null,
      contactName: order.contactName ?? null,
      contactEmail: order.contactEmail ?? null,
      contactPhone: order.contactPhone ?? null,
      paymentMethod: payment?.method ?? null,
      paymentReference: payment?.reference ?? null,
      uploadProofUrl:
        typeof this.toRecord(this.toRecord(payment?.verificationContextJson)?.proofUpload)?.url === 'string'
          ? (this.toRecord(this.toRecord(payment?.verificationContextJson)?.proofUpload)?.url as string)
          : null,
      merchantConfiguration: merchantConfiguration
        ? {
            providerName: merchantConfiguration.providerName,
            accountName: merchantConfiguration.accountName,
            accountNumber: merchantConfiguration.accountNumber,
            qrImageUrl,
          }
        : null,
      shippingAddress: order.shippingAddressJson,
    };
  }

  private toRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  private formatAddress(address: unknown) {
    const record = this.toRecord(address);
    if (!record) return '-';
    const parts: string[] = [];
    if (record.addressLine1) parts.push(record.addressLine1 as string);
    if (record.addressLine2) parts.push(record.addressLine2 as string);
    if (record.city) parts.push(record.city as string);
    if (record.stateOrProvince) parts.push(record.stateOrProvince as string);
    if (record.postalCode) parts.push(record.postalCode as string);
    if (record.country) parts.push(record.country as string);
    return parts.join(', ') || '-';
  }

  private escapeHtml(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}