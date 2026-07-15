import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import {
  normalizeEmail,
  normalizeOptionalToken,
  sanitizeOptionalPlainText,
  sanitizePlainText,
} from '../../common/utils/input-sanitizer.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CreateStoreCustomerAddressDto,
  StoreCustomerAddressDto,
  StoreMeDto,
  StoreOrderDetailDto,
  StoreOrderListQueryDto,
  UpdateStoreCustomerAddressDto,
  UpdateStoreMeDto,
} from './dto/store-account.dto';

@Injectable()
export class StoreAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<StoreMeDto> {
    const customer = await this.resolveCustomer(userId);

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? '',
      createdAt: customer.createdAt,
    };
  }

  async updateMe(userId: string, dto: UpdateStoreMeDto) {
    const customer = await this.resolveCustomer(userId);
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: dto.name === undefined ? undefined : sanitizePlainText(dto.name),
        phone:
          dto.phone === undefined
            ? undefined
            : (normalizeOptionalToken(dto.phone) ?? null),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email ?? '',
      createdAt: updated.createdAt,
    };
  }

  async listAddresses(userId: string) {
    const customer = await this.resolveCustomer(userId);
    const addresses = await this.prisma.customerAddress.findMany({
      where: { customerId: customer.id },
      orderBy: [{ isDefaultShipping: 'desc' }, { id: 'asc' }],
    });

    return addresses.map((address) => this.mapAddress(address));
  }

  async createAddress(userId: string, dto: CreateStoreCustomerAddressDto) {
    const customer = await this.resolveCustomer(userId);

    if (dto.isDefaultShipping || dto.isDefaultBilling) {
      await this.clearDefaults(customer.id, dto);
    }

    const address = await this.prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        addressLine: sanitizePlainText(dto.addressLine1),
        label: sanitizeOptionalPlainText(dto.label) ?? null,
        recipientName: sanitizeOptionalPlainText(dto.recipientName) ?? null,
        phone: normalizeOptionalToken(dto.phone) ?? null,
        addressLine2: sanitizeOptionalPlainText(dto.addressLine2) ?? null,
        city: sanitizePlainText(dto.city),
        stateOrProvince: sanitizeOptionalPlainText(dto.stateOrProvince) ?? null,
        postalCode: sanitizePlainText(dto.postalCode),
        country: sanitizePlainText(dto.country),
        isDefault: Boolean(dto.isDefaultShipping || dto.isDefaultBilling),
        isDefaultShipping: dto.isDefaultShipping ?? false,
        isDefaultBilling: dto.isDefaultBilling ?? false,
      },
    });

    return this.mapAddress(address);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateStoreCustomerAddressDto,
  ) {
    const customer = await this.resolveCustomer(userId);
    await this.ensureAddressOwnership(customer.id, addressId);

    if (dto.isDefaultShipping || dto.isDefaultBilling) {
      await this.clearDefaults(customer.id, dto, addressId);
    }

    const address = await this.prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        addressLine:
          dto.addressLine1 === undefined
            ? undefined
            : sanitizePlainText(dto.addressLine1),
        label:
          dto.label === undefined
            ? undefined
            : (sanitizeOptionalPlainText(dto.label) ?? null),
        recipientName:
          dto.recipientName === undefined
            ? undefined
            : (sanitizeOptionalPlainText(dto.recipientName) ?? null),
        phone:
          dto.phone === undefined
            ? undefined
            : (normalizeOptionalToken(dto.phone) ?? null),
        addressLine2:
          dto.addressLine2 === undefined
            ? undefined
            : (sanitizeOptionalPlainText(dto.addressLine2) ?? null),
        city: dto.city === undefined ? undefined : sanitizePlainText(dto.city),
        stateOrProvince:
          dto.stateOrProvince === undefined
            ? undefined
            : (sanitizeOptionalPlainText(dto.stateOrProvince) ?? null),
        postalCode:
          dto.postalCode === undefined
            ? undefined
            : sanitizePlainText(dto.postalCode),
        country:
          dto.country === undefined
            ? undefined
            : sanitizePlainText(dto.country),
        isDefault: Boolean(dto.isDefaultShipping || dto.isDefaultBilling),
        isDefaultShipping: dto.isDefaultShipping,
        isDefaultBilling: dto.isDefaultBilling,
      },
    });

    return this.mapAddress(address);
  }

  async deleteAddress(userId: string, addressId: string) {
    const customer = await this.resolveCustomer(userId);
    await this.ensureAddressOwnership(customer.id, addressId);
    await this.prisma.customerAddress.delete({
      where: { id: addressId },
    });

    return { deleted: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const customer = await this.resolveCustomer(userId);
    await this.ensureAddressOwnership(customer.id, addressId);

    await this.prisma.$transaction([
      this.prisma.customerAddress.updateMany({
        where: { customerId: customer.id },
        data: {
          isDefault: false,
          isDefaultShipping: false,
          isDefaultBilling: false,
        },
      }),
      this.prisma.customerAddress.update({
        where: { id: addressId },
        data: {
          isDefault: true,
          isDefaultShipping: true,
          isDefaultBilling: true,
        },
      }),
    ]);

    const address = await this.prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return this.mapAddress(address);
  }

  async listOrders(userId: string, query: StoreOrderListQueryDto) {
    const customer = await this.resolveCustomer(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = {
      customerId: customer.id,
      status: query.status as never,
    };
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          type: true,
          createdAt: true,
          currency: true,
          total: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        status: order.status,
        type: order.type,
        createdAt: order.createdAt,
        currency: order.currency,
        total: order.total.toString(),
      })),
      pagination: this.pagination(page, limit, total),
    };
  }

  async getOrderDetail(
    userId: string,
    orderId: string,
  ): Promise<StoreOrderDetailDto> {
    const customer = await this.resolveCustomer(userId);
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: customer.id,
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
              select: {
                name: true,
              },
            },
            variant: {
              select: {
                name: true,
              },
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
          orderBy: { createdAt: 'asc' },
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

  async claimGuestOrdersForCustomer(customerId: string, email: string) {
    return this.prisma.order.updateMany({
      where: {
        customerId: null,
        guestEmail: normalizeEmail(email) ?? email.toLowerCase(),
      },
      data: {
        customerId,
      },
    });
  }

  async ensureCustomerForUser(userId: string) {
    return this.resolveCustomer(userId);
  }

  private async resolveCustomer(userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM users
        WHERE id = ${userId}
        FOR UPDATE
      `;

      const existingCustomer = await transaction.customer.findFirst({
        where: { userId },
      });

      if (existingCustomer) {
        return existingCustomer;
      }

      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const customer = await transaction.customer.create({
        data: {
          name: user.name,
          email: normalizeEmail(user.email) ?? user.email.toLowerCase(),
          userId: user.id,
        },
      });

      await transaction.order.updateMany({
        where: {
          customerId: null,
          guestEmail: normalizeEmail(user.email) ?? user.email.toLowerCase(),
        },
        data: {
          customerId: customer.id,
        },
      });

      return customer;
    });
  }

  private async ensureAddressOwnership(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }
  }

  private async clearDefaults(
    customerId: string,
    dto: { isDefaultShipping?: boolean; isDefaultBilling?: boolean },
    excludeId?: string,
  ) {
    if (!dto.isDefaultShipping && !dto.isDefaultBilling) {
      return;
    }

    await this.prisma.customerAddress.updateMany({
      where: {
        customerId,
        id: excludeId ? { not: excludeId } : undefined,
      },
      data: {
        isDefault: false,
        ...(dto.isDefaultShipping ? { isDefaultShipping: false } : {}),
        ...(dto.isDefaultBilling ? { isDefaultBilling: false } : {}),
      },
    });
  }

  private mapAddress(address: {
    id: string;
    label: string | null;
    recipientName: string | null;
    phone: string | null;
    addressLine: string;
    addressLine2: string | null;
    city: string;
    stateOrProvince: string | null;
    postalCode: string;
    country: string;
    isDefaultShipping: boolean;
    isDefaultBilling: boolean;
  }): StoreCustomerAddressDto {
    return {
      id: address.id,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine,
      addressLine2: address.addressLine2,
      city: address.city,
      stateOrProvince: address.stateOrProvince,
      postalCode: address.postalCode,
      country: address.country,
      isDefaultShipping: address.isDefaultShipping,
      isDefaultBilling: address.isDefaultBilling,
    };
  }

  private pagination(page: number, limit: number, total: number) {
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }
}
