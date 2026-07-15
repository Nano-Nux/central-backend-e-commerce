import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { StoreAccountService } from './store-account.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class StoreGuestOrdersService {
  private readonly verificationTtlMinutes = 15;
  private readonly accessTtlMinutes = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly storeAccountService: StoreAccountService,
  ) {}

  async requestLookup(email: string, orderId?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const matchingOrder = await this.prisma.order.findFirst({
      where: {
        guestEmail: normalizedEmail,
        ...(orderId ? { id: orderId } : {}),
      },
      select: { id: true },
    });

    if (!matchingOrder) {
      return {
        sent: false,
      };
    }

    const verificationToken = randomBytes(24).toString('hex');
    const code = this.generateCode();
    const expiresAt = this.futureDate(this.verificationTtlMinutes);

    await this.prisma.guestOrderVerification.create({
      data: {
        email: normalizedEmail,
        tokenHash: this.hash(verificationToken),
        codeHash: this.hash(code),
        expiresAt,
      },
    });

    await this.emailService.queueEmail({
      toEmail: normalizedEmail,
      subject: 'Verify your guest order access',
      body: `Your guest order verification code is ${code}. It expires in ${this.verificationTtlMinutes} minutes.\nVerification token: ${verificationToken}`,
    });

    return {
      sent: true,
    };
  }

  async verifyLookup(email: string, code: string, verificationToken: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const accessToken = randomBytes(32).toString('hex');
    const expiresAt = this.futureDate(this.accessTtlMinutes);
    const tokenHash = this.hash(verificationToken);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM guest_order_verifications
        WHERE token_hash = ${tokenHash}
        FOR UPDATE
      `;

      const record = await transaction.guestOrderVerification.findUnique({
        where: { tokenHash },
      });

      if (
        !record ||
        record.email !== normalizedEmail ||
        record.codeHash !== this.hash(code) ||
        record.expiresAt <= new Date() ||
        record.consumedAt
      ) {
        throw new UnauthorizedException('Invalid guest order verification');
      }

      await transaction.guestOrderVerification.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });

      await transaction.guestOrderAccessToken.create({
        data: {
          email: normalizedEmail,
          tokenHash: this.hash(accessToken),
          expiresAt,
        },
      });
    });

    return {
      accessToken,
      expiresAt,
    };
  }

  async validateGuestAccessToken(token: string) {
    const record = await this.prisma.guestOrderAccessToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });

    if (!record || record.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid guest access token');
    }

    return record;
  }

  async issueGuestAccessToken(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const accessToken = randomBytes(32).toString('hex');
    const expiresAt = this.futureDate(this.accessTtlMinutes);

    await this.prisma.guestOrderAccessToken.create({
      data: {
        email: normalizedEmail,
        tokenHash: this.hash(accessToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      expiresAt,
    };
  }

  async listOrders(email: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        guestEmail: email,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        type: true,
        createdAt: true,
        currency: true,
        total: true,
      },
    });

    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      type: order.type,
      createdAt: order.createdAt,
      currency: order.currency,
      total: order.total.toString(),
    }));
  }

  async getOrder(email: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        guestEmail: email,
      },
      select: {
        id: true,
        status: true,
        type: true,
        createdAt: true,
        currency: true,
        total: true,
        subtotal: true,
        discount: true,
        tax: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: {
              select: { name: true },
            },
            variant: {
              select: { name: true },
            },
          },
        },
        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            status: true,
            reference: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      status: order.status,
      type: order.type,
      createdAt: order.createdAt,
      currency: order.currency,
      total: order.total.toString(),
      subtotal: order.subtotal.toString(),
      discount: order.discount.toString(),
      tax: order.tax.toString(),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        variantId: item.variantId,
        variantName: item.variant?.name ?? null,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount.toString(),
        status: payment.status,
        reference: payment.reference,
        createdAt: payment.createdAt,
      })),
    };
  }

  async queueInvoice(email: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, guestEmail: email },
      select: {
        id: true,
        total: true,
        currency: true,
        contactName: true,
        guestName: true,
        contactEmail: true,
        guestEmail: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    const recipient = order.contactEmail ?? order.guestEmail;
    if (!recipient) throw new UnauthorizedException('Order has no email address');

    const itemLines = order.items.map((item) =>
      `${item.product.name}${item.variant?.name ? ` (${item.variant.name})` : ''} x ${item.quantity.toString()} - ${item.totalPrice.toString()} ${order.currency}`,
    );

    await this.emailService.queueEmail({
      toEmail: recipient,
      subject: `Order invoice ${order.id}`,
      body: [
        `Hello ${order.contactName ?? order.guestName ?? 'Customer'},`,
        '',
        `Order: ${order.id}`,
        `Total: ${order.total.toString()} ${order.currency}`,
        '',
        'Items:',
        ...itemLines,
        '',
        'Thank you for your purchase.',
      ].join('\n'),
    });

    return { queued: true };
  }

  async claimOrders(user: AuthenticatedUser, guestAccessToken: string) {
    const access = await this.validateGuestAccessToken(guestAccessToken);

    if (user.email.toLowerCase() !== access.email.toLowerCase()) {
      throw new UnauthorizedException(
        'Guest order email does not match account',
      );
    }

    const customer = await this.storeAccountService.ensureCustomerForUser(
      user.id,
    );
    const result = await this.storeAccountService.claimGuestOrdersForCustomer(
      customer.id,
      access.email,
    );

    await this.emailService.queueEmail({
      toEmail: access.email,
      subject: 'Guest orders claimed',
      body: `Your guest orders have been attached to your account. Claimed orders: ${result.count}.`,
    });

    return {
      claimedCount: result.count,
    };
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private generateCode() {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private futureDate(minutes: number) {
    return new Date(Date.now() + minutes * 60 * 1000);
  }
}
