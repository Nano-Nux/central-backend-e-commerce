import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import { OrderSource, OrderStatus, OrderType } from '../../../generated/prisma/enums';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import {
  OrderCancelledEvent,
  OrderCompletedEvent,
  OrderCreatedEvent,
  OrderPaidEvent,
  OrderRefundedEvent,
} from '../../infrastructure/event-bus/events/order-created.event';
import { AuditContext, AuditService } from '../audit/audit.service';
import {
  BarcodeRegistryService,
} from '../inventory/barcode-registry.service';
import { InventoryAssetsService } from '../inventory/inventory-assets.service';
import {
  PricingCustomerType,
  PricingService,
} from '../pricing/pricing.service';
import { InventoryIdentityResolverService } from '../inventory/inventory-identity-resolver.service';
import { StockItemConfigurationService } from '../inventory/stock-item-configuration.service';
import { UpdateOrderDto } from '../shared/dto/update-order.dto';
import { CreateOrderDto, CreateOrderItemDto } from '../shared/dto/create-order.dto';
import { OrderListQueryDto } from '../shared/dto/order-list-query.dto';
import {
  createPaginationMeta,
  normalizePagination,
} from '../shared/helpers/pagination.helper';
import { OrdersRepository } from './orders.repository';

type LineItem = {
  productId: string;
  stockItemId: string | null;
  variantId?: string;
  unitId: string | null;
  isStockTracked: boolean;
  isSerialized: boolean;
  assetIds: string[];
  serialNumbers: string[];
  quantity: Prisma.Decimal;
  baseQuantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
};

type CreateOrderOptions = {
  orderType?: OrderType;
  requestKey?: string;
  guest?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  shippingAddress?: Prisma.InputJsonValue;
  billingAddress?: Prisma.InputJsonValue;
  orderNotes?: string;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly pricingService: PricingService,
    private readonly inventoryIdentityResolver: InventoryIdentityResolverService,
    private readonly stockItemConfigurationService: StockItemConfigurationService,
    private readonly inventoryAssetsService: InventoryAssetsService,
    private readonly barcodeRegistryService: BarcodeRegistryService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    dto: CreateOrderDto,
    context?: AuditContext,
    options?: CreateOrderOptions,
    transaction?: Prisma.TransactionClient,
  ) {
    return this.createWithSource(
      dto,
      OrderSource.ONLINE,
      context,
      options,
      transaction,
    );
  }

  async calculateSubtotal(items: CreateOrderItemDto[], customerType: PricingCustomerType) {
    const lines = await Promise.all(items.map((item) => this.buildLineItem(item, customerType)));
    return lines.reduce((total, item) => total.plus(item.totalPrice), new Prisma.Decimal(0));
  }

  async createPOSOrder(
    dto: CreateOrderDto,
    context?: AuditContext,
    options?: CreateOrderOptions,
    transaction?: Prisma.TransactionClient,
  ) {
    return this.createWithSource(
      dto,
      OrderSource.POS,
      context,
      {
        orderType: OrderType.POS,
        requestKey: options?.requestKey,
      },
      transaction,
    );
  }

  async findAll(query: OrderListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where = this.ordersRepository.buildWhere(query);
    const [orders, total] = await Promise.all([
      this.ordersRepository.findMany({ where, skip, take }),
      this.ordersRepository.count(where),
    ]);

    return {
      data: orders,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async findOne(id: string) {
    const order = await this.ordersRepository.findById(id);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async update(id: string, dto: UpdateOrderDto, context?: AuditContext) {
    const before = await this.findOne(id);

    if (before.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be updated');
    }

    const updated = await this.ordersRepository.updateDetails(id, {
      orderNotes: dto.orderNotes,
      shippingAddressJson:
        dto.shippingAddress === null
          ? Prisma.JsonNull
          : (dto.shippingAddress as Prisma.InputJsonValue | undefined),
      billingAddressJson:
        dto.billingAddress === null
          ? Prisma.JsonNull
          : (dto.billingAddress as Prisma.InputJsonValue | undefined),
    });

    this.auditService.logUpdate(
      'ORDER',
      id,
      this.orderSnapshot(before),
      this.orderSnapshot(updated),
      undefined,
      context,
    );
    return updated;
  }

  async markPaid(id: string, context?: AuditContext) {
    const order = await this.findOne(id);

    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.COMPLETED
    ) {
      return order;
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'Order cannot be paid in its current status',
      );
    }

    const updatedOrder = await this.ordersRepository.transaction(
      async (transaction) => {
        const updated = await this.ordersRepository.updateStatus(
          id,
          OrderStatus.PAID,
          transaction,
        );

        await this.eventBus.publish(
          new OrderPaidEvent(this.orderSnapshot(updated), {
            userId: context?.actorId ?? undefined,
            source: 'orders',
          }),
          transaction,
        );

        return updated;
      },
    );

    this.auditService.logAction(
      'ORDER_STATUS_CHANGED',
      'ORDER',
      id,
      { status: order.status },
      { status: updatedOrder.status },
      { reason: 'PAYMENT_RECEIVED' },
      context,
    );

    return updatedOrder;
  }

  async complete(id: string, context?: AuditContext) {
    const order = await this.findOne(id);

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Only paid orders can be completed');
    }

    const updatedOrder = await this.ordersRepository.transaction(
      async (transaction) => {
        const updated = await this.ordersRepository.updateStatus(
          id,
          OrderStatus.COMPLETED,
          transaction,
        );

        await this.eventBus.publish(
          new OrderCompletedEvent(this.orderSnapshot(updated), {
            userId: context?.actorId ?? undefined,
            source: 'orders',
          }),
          transaction,
        );

        return updated;
      },
    );

    this.auditService.logAction(
      'ORDER_STATUS_CHANGED',
      'ORDER',
      id,
      { status: order.status },
      { status: updatedOrder.status },
      { reason: 'ORDER_COMPLETED' },
      context,
    );

    return updatedOrder;
  }

  async markRefunded(id: string, context?: AuditContext) {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.REFUNDED) {
      return order;
    }

    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Only paid or completed orders can be refunded',
      );
    }

    const updatedOrder = await this.ordersRepository.transaction(
      async (transaction) => {
        const updated = await this.ordersRepository.updateStatus(
          id,
          OrderStatus.REFUNDED,
          transaction,
        );

        await this.eventBus.publish(
          new OrderRefundedEvent(this.orderSnapshot(updated), {
            userId: context?.actorId ?? undefined,
            source: 'orders',
          }),
          transaction,
        );

        return updated;
      },
    );

    this.auditService.logAction(
      'ORDER_STATUS_CHANGED',
      'ORDER',
      id,
      { status: order.status },
      { status: updatedOrder.status },
      { reason: 'PAYMENT_REFUNDED' },
      context,
    );

    return updatedOrder;
  }

  async cancel(id: string, context?: AuditContext) {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.CANCELLED) {
      return order;
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    const updatedOrder = await this.ordersRepository.transaction(
      async (transaction) => {
        const updated = await this.ordersRepository.updateStatus(
          id,
          OrderStatus.CANCELLED,
          transaction,
        );

        await this.eventBus.publish(
          new OrderCancelledEvent(this.orderSnapshot(updated), {
            userId: context?.actorId ?? undefined,
            source: 'orders',
          }),
          transaction,
        );

        return updated;
      },
    );

    this.auditService.logAction(
      'ORDER_STATUS_CHANGED',
      'ORDER',
      id,
      { status: order.status },
      { status: updatedOrder.status },
      { reason: 'ORDER_CANCELLED' },
      context,
    );

    return updatedOrder;
  }

  private async createWithSource(
    dto: CreateOrderDto,
    source: OrderSource,
    context?: AuditContext,
    options?: CreateOrderOptions,
    transaction?: Prisma.TransactionClient,
  ) {
    const lines = await Promise.all(
      dto.items.map((item) =>
        this.buildLineItem(
          item,
          dto.customerType ?? PricingCustomerType.RETAIL,
        ),
      ),
    );
    const subtotal = lines.reduce(
      (total, item) => total.plus(item.totalPrice),
      new Prisma.Decimal(0),
    );
    const discount = this.toNonNegativeDecimal(dto.discount ?? 0, 'Discount');
    const tax = this.toNonNegativeDecimal(dto.tax ?? 0, 'Tax');
    const total = subtotal.minus(discount).plus(tax);

    if (total.lt(0)) {
      throw new BadRequestException('Order total cannot be negative');
    }

    const requestKey =
      options?.requestKey ??
      dto.idempotencyKey ??
      this.buildOrderRequestKey({
        source,
        actorId: context?.actorId ?? null,
        customerId: dto.customerId ?? null,
        orderType:
          options?.orderType ??
          (dto.customerId ? OrderType.CUSTOMER : OrderType.GUEST),
        guest: options?.guest,
        discount: discount.toString(),
        tax: tax.toString(),
          items: lines.map((item) => ({
            productId: item.productId,
            stockItemId: item.stockItemId,
            unitId: item.unitId,
            variantId: item.variantId ?? null,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
          assetIds: [...item.assetIds].sort(),
          serialNumbers: [...item.serialNumbers].sort(),
        })),
      });

    const existingOrder = await this.ordersRepository.findByRequestKey(requestKey);

    if (existingOrder) {
      return existingOrder;
    }

    let order: Awaited<ReturnType<OrdersRepository['create']>>;

    try {
      const persist = async (transactionClient: Prisma.TransactionClient) => {
        const duplicatedOrder =
          await this.ordersRepository.findByRequestKey(requestKey, transactionClient);

        if (duplicatedOrder) {
          return duplicatedOrder;
        }

        const createdOrder = await this.ordersRepository.create(
          {
            requestKey,
            customer: dto.customerId
              ? {
                  connect: {
                    id: dto.customerId,
                  },
                }
              : undefined,
            type:
              options?.orderType ??
              (dto.customerId ? OrderType.CUSTOMER : OrderType.GUEST),
            guestName: options?.guest?.name?.trim() || null,
            guestEmail: options?.guest?.email?.trim() || null,
            guestPhone: options?.guest?.phone?.trim() || null,
            contactName: options?.contact?.name?.trim() || null,
            contactEmail: options?.contact?.email?.trim() || null,
            contactPhone: options?.contact?.phone?.trim() || null,
            shippingAddressJson: options?.shippingAddress,
            billingAddressJson: options?.billingAddress,
            orderNotes: options?.orderNotes?.trim() || null,
            status: OrderStatus.PENDING,
            source,
            subtotal,
            discount,
            tax,
            total,
            currency: this.configService.getOrThrow<string>('APP_CURRENCY'),
            items: {
              create: lines.map((item) => ({
                productId: item.productId,
                stockItemId: item.stockItemId,
                variantId: item.variantId,
                unitId: item.unitId,
                assetIds: item.assetIds,
                serialNumbers: item.serialNumbers,
                quantity: item.quantity,
                baseQuantity: item.baseQuantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              })),
            },
          },
          transactionClient,
        );

        await this.eventBus.publish(
          new OrderCreatedEvent(this.orderSnapshot(createdOrder), {
            userId: context?.actorId ?? undefined,
            source: 'orders',
          }),
          transactionClient,
        );

        return createdOrder;
      };

      order = transaction
        ? await persist(transaction)
        : await this.ordersRepository.transaction(persist);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicatedOrder =
          await this.ordersRepository.findByRequestKey(requestKey);

        if (duplicatedOrder) {
          return duplicatedOrder;
        }
      }

      throw error;
    }

    this.auditService.logCreate(
      'ORDER',
      order.id,
      this.orderSnapshot(order),
      undefined,
      context,
    );

    return order;
  }

  private async buildLineItem(
    item: {
      productId?: string;
      stockItemId?: string;
      unitId?: string;
      variantId?: string;
      barcode?: string;
      quantity: number;
      assetIds?: string[];
      serialNumbers?: string[];
    },
    customerType: PricingCustomerType,
  ): Promise<LineItem> {
    const identity = await this.resolveItemIdentity(item);
    const product = await this.ordersRepository.findProductForOrderItem(
      identity.productId,
      identity.variantId ?? undefined,
    );

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    if (identity.variantId && product.variants.length === 0) {
      throw new NotFoundException('Product variant not found');
    }

    const quantity = this.toPositiveDecimal(item.quantity, 'Quantity');
    const serialNumbers = item.serialNumbers ?? [];
    const resolvedInventoryIdentity =
      await this.inventoryIdentityResolver.resolveForWrite({
        productId: identity.productId,
        variantId: identity.variantId,
        stockItemId: item.stockItemId ?? identity.stockItemId,
        unitId: item.unitId ?? identity.unitId,
        quantity,
      });

    const config = await this.stockItemConfigurationService.assertSalesConfiguration({
      stockItemId: resolvedInventoryIdentity.stockItemId,
      unitId: resolvedInventoryIdentity.unitId,
      assetIds: item.assetIds,
      serialNumbers,
    });

    const assetIds =
      config?.trackUniqueAssets && resolvedInventoryIdentity.stockItemId
        ? await this.inventoryAssetsService.resolveSaleAssetIds({
            productId: identity.productId,
            stockItemId: resolvedInventoryIdentity.stockItemId,
            quantity,
            assetIds: item.assetIds,
            serialNumbers,
          })
        : [];

    if (product.isSerialized && assetIds.length === 0) {
      await this.ensureSerializedItem(
        product.id,
        quantity,
        serialNumbers,
        resolvedInventoryIdentity.stockItemId,
      );
    } else if (serialNumbers.length) {
      throw new BadRequestException(
        'Serial numbers can only be provided for serialized products',
      );
    }

    const resolvedPrice = await this.pricingService.resolvePrice({
      productId: identity.productId,
      variantId: identity.variantId,
      customerType,
      currentDate: new Date(),
    });
    const unitPrice = resolvedPrice.finalPrice;

    return {
      productId: identity.productId,
      stockItemId: resolvedInventoryIdentity.stockItemId,
      variantId: identity.variantId ?? undefined,
      unitId: item.unitId ?? identity.unitId ?? resolvedInventoryIdentity.unitId,
      isStockTracked: product.isStockTracked,
      isSerialized: product.isSerialized,
      assetIds,
      serialNumbers,
      quantity,
      baseQuantity: resolvedInventoryIdentity.baseQuantity,
      unitPrice,
      totalPrice: unitPrice.mul(quantity),
    };
  }

  private toPositiveDecimal(value: number, fieldName: string) {
    const decimal = this.toNonNegativeDecimal(value, fieldName);

    if (decimal.eq(0)) {
      throw new BadRequestException(`${fieldName} must be greater than zero`);
    }

    return decimal;
  }

  private toNonNegativeDecimal(value: number, fieldName: string) {
    const decimal = new Prisma.Decimal(value);

    if (decimal.lt(0)) {
      throw new BadRequestException(`${fieldName} must be zero or greater`);
    }

    return decimal;
  }

  private orderSnapshot(order: {
    id: string;
    status: OrderStatus;
    source: OrderSource;
    subtotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    tax: Prisma.Decimal;
    total: Prisma.Decimal;
    currency: string;
    customerId?: string | null;
    type: OrderType;
    guestName?: string | null;
    guestEmail?: string | null;
    guestPhone?: string | null;
    items?: Array<{
      id: string;
      productId: string;
      stockItemId?: string | null;
      variantId?: string | null;
      unitId?: string | null;
      assetIds?: Prisma.JsonValue | null;
      serialNumbers?: Prisma.JsonValue | null;
      product?: {
        isStockTracked: boolean;
        isSerialized: boolean;
      };
      quantity: Prisma.Decimal;
      baseQuantity?: Prisma.Decimal | null;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }>;
  }) {
    return {
      id: order.id,
      customerId: order.customerId ?? null,
      type: order.type,
      guestName: order.guestName ?? null,
      guestEmail: order.guestEmail ?? null,
      guestPhone: order.guestPhone ?? null,
      status: order.status,
      source: order.source,
      subtotal: order.subtotal.toString(),
      discount: order.discount.toString(),
      tax: order.tax.toString(),
      total: order.total.toString(),
      currency: order.currency,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        stockItemId: item.stockItemId ?? null,
        variantId: item.variantId ?? null,
        unitId: item.unitId ?? null,
        assetIds: this.parseAssetIds(item.assetIds),
        isStockTracked: item.product?.isStockTracked ?? true,
        isSerialized: item.product?.isSerialized ?? false,
        serialNumbers: this.parseSerialNumbers(item.serialNumbers),
        quantity: item.quantity.toString(),
        baseQuantity: (item.baseQuantity ?? item.quantity).toString(),
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
      })),
    };
  }

  private async ensureSerializedItem(
    productId: string,
    quantity: Prisma.Decimal,
    serialNumbers: string[],
    stockItemId?: string | null,
  ) {
    const quantityAsNumber = Number(quantity.toString());

    if (
      !Number.isSafeInteger(quantityAsNumber) ||
      quantityAsNumber !== serialNumbers.length
    ) {
      throw new BadRequestException('Serial number count must match quantity');
    }

    const availableSerialCount =
      await this.ordersRepository.countAvailableSerialNumbers(
        productId,
        serialNumbers,
        stockItemId,
      );

    if (availableSerialCount !== serialNumbers.length) {
      throw new BadRequestException(
        'One or more serial numbers are unavailable',
      );
    }
  }

  private async resolveItemIdentity(item: {
    productId?: string;
    stockItemId?: string;
    unitId?: string;
    variantId?: string;
    barcode?: string;
  }) {
    if (item.productId) {
      return {
        productId: item.productId,
        variantId: item.variantId,
        stockItemId: item.stockItemId ?? null,
        unitId: item.unitId ?? null,
      };
    }

    if (!item.barcode) {
      throw new BadRequestException('Order item product or barcode is required');
    }

    const resolved = await this.barcodeRegistryService.resolveProductSelection(
      item.barcode,
    );

    if (!resolved) {
      throw new NotFoundException('Barcode not found');
    }

    return resolved;
  }

  private parseSerialNumbers(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private parseAssetIds(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private buildOrderRequestKey(input: {
    source: OrderSource;
    actorId: string | null;
    customerId: string | null;
    orderType: OrderType;
    guest?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    discount: string;
    tax: string;
    items: Array<{
      productId: string;
      stockItemId: string | null;
      unitId: string | null;
      variantId: string | null;
      quantity: string;
      unitPrice: string;
      totalPrice: string;
      assetIds: string[];
      serialNumbers: string[];
    }>;
  }) {
    return createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
  }
}
