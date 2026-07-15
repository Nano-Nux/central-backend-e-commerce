import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PurchaseOrderStatus } from '../../../generated/prisma/enums';
import { SystemEvents } from '../../common/constants/event.constants';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { InventoryIdentityResolverService } from '../inventory/inventory-identity-resolver.service';
import { StockItemConfigurationService } from '../inventory/stock-item-configuration.service';
import { CreatePurchaseOrderDto } from '../purchase/dto/create-purchase-order.dto';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PurchaseOrdersRepository } from './purchase-orders.repository';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly purchaseOrdersRepository: PurchaseOrdersRepository,
    private readonly suppliersService: SuppliersService,
    private readonly inventoryIdentityResolver: InventoryIdentityResolverService,
    private readonly stockItemConfigurationService: StockItemConfigurationService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreatePurchaseOrderDto, context?: AuditContext) {
    const supplier = await this.suppliersService.findOne(dto.supplierId);

    if (!supplier.isActive) {
      throw new BadRequestException('Supplier is inactive');
    }

    await Promise.all(
      dto.items.map(async (item) => {
        const product = await this.purchaseOrdersRepository.findProductById(
          item.productId,
        );

        if (!product || !product.isActive) {
          throw new NotFoundException('Product not found');
        }
      }),
    );

    const lines = await Promise.all(dto.items.map(async (item) => {
      const quantity = new Prisma.Decimal(item.quantity);
      const unitCost = new Prisma.Decimal(item.unitCost);
      const resolvedIdentity =
        await this.inventoryIdentityResolver.resolveForWrite({
          productId: item.productId,
          stockItemId: item.stockItemId,
          unitId: item.unitId,
          quantity,
        });

      await this.stockItemConfigurationService.assertUnitConfiguration({
        stockItemId: resolvedIdentity.stockItemId,
        unitId: resolvedIdentity.unitId,
      });

      return {
        productId: item.productId,
        stockItemId: resolvedIdentity.stockItemId,
        unitId: resolvedIdentity.unitId,
        quantity,
        baseQuantity: resolvedIdentity.baseQuantity,
        unitCost,
        totalCost: quantity.mul(unitCost),
      };
    }));
    const subtotal = lines.reduce(
      (total, line) => total.plus(line.totalCost),
      new Prisma.Decimal(0),
    );
    const tax = new Prisma.Decimal(dto.tax ?? 0);
    const total = subtotal.plus(tax);

    const purchaseOrder = await this.purchaseOrdersRepository.transaction(
      async (transaction) => {
        const createdPurchaseOrder = await this.purchaseOrdersRepository.create(
          {
            supplier: { connect: { id: dto.supplierId } },
            status: PurchaseOrderStatus.DRAFT,
            subtotal,
            tax,
            total,
            items: {
              create: lines,
            },
          },
          transaction,
        );

        await this.eventBus.publish(
          SystemEvents.PURCHASE_ORDER_CREATED,
          {
            purchaseOrder: this.snapshot(createdPurchaseOrder),
          },
          {
            userId: context?.actorId ?? undefined,
            source: 'purchase',
          },
          transaction,
        );

        return createdPurchaseOrder;
      },
    );

    this.auditService.logCreate(
      'PURCHASE_ORDER',
      purchaseOrder.id,
      this.snapshot(purchaseOrder),
      undefined,
      context,
    );

    return purchaseOrder;
  }

  findAll() {
    return this.purchaseOrdersRepository.findMany();
  }

  async findOne(id: string) {
    const purchaseOrder = await this.purchaseOrdersRepository.findById(id);

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    return purchaseOrder;
  }

  async approve(id: string, context?: AuditContext) {
    const before = await this.findOne(id);

    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft purchase orders can be approved',
      );
    }

    const purchaseOrder = await this.purchaseOrdersRepository.transaction(
      async (transaction) => {
        const updatedPurchaseOrder =
          await this.purchaseOrdersRepository.updateStatus(
            id,
            PurchaseOrderStatus.APPROVED,
            transaction,
          );

        await this.eventBus.publish(
          SystemEvents.PURCHASE_ORDER_APPROVED,
          {
            purchaseOrder: {
              ...this.snapshot(updatedPurchaseOrder),
              status: updatedPurchaseOrder.status,
            },
          },
          {
            userId: context?.actorId ?? undefined,
            source: 'purchase',
          },
          transaction,
        );

        return updatedPurchaseOrder;
      },
    );

    this.auditService.logUpdate(
      'PURCHASE_ORDER',
      id,
      { status: before.status },
      { status: purchaseOrder.status },
      undefined,
      context,
    );

    return purchaseOrder;
  }

  async cancel(id: string, context?: AuditContext) {
    const before = await this.findOne(id);

    if (before.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        'Received purchase orders cannot be cancelled',
      );
    }

    const purchaseOrder = await this.purchaseOrdersRepository.transaction(
      async (transaction) => {
        const updatedPurchaseOrder =
          await this.purchaseOrdersRepository.updateStatus(
            id,
            PurchaseOrderStatus.CANCELLED,
            transaction,
          );

        await this.eventBus.publish(
          SystemEvents.PURCHASE_ORDER_CANCELLED,
          {
            purchaseOrder: {
              ...this.snapshot(updatedPurchaseOrder),
              status: updatedPurchaseOrder.status,
            },
          },
          {
            userId: context?.actorId ?? undefined,
            source: 'purchase',
          },
          transaction,
        );

        return updatedPurchaseOrder;
      },
    );

    this.auditService.logAction(
      'PURCHASE_ORDER_CANCELLED',
      'PURCHASE_ORDER',
      id,
      { status: before.status },
      { status: purchaseOrder.status },
      undefined,
      context,
    );

    return purchaseOrder;
  }

  private snapshot(purchaseOrder: {
    id: string;
    total: Prisma.Decimal;
    status?: PurchaseOrderStatus;
    items?: Array<{
      id: string;
      productId: string;
      stockItemId?: string | null;
      unitId?: string | null;
      quantity: Prisma.Decimal;
      baseQuantity?: Prisma.Decimal | null;
      unitCost: Prisma.Decimal;
      totalCost: Prisma.Decimal;
      receivedQuantity?: Prisma.Decimal;
    }>;
  }) {
    return {
      id: purchaseOrder.id,
      total: purchaseOrder.total.toString(),
      status: purchaseOrder.status,
      items: (purchaseOrder.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        stockItemId: item.stockItemId ?? null,
        unitId: item.unitId ?? null,
        quantity: item.quantity.toString(),
        baseQuantity: (item.baseQuantity ?? item.quantity).toString(),
        unitCost: item.unitCost.toString(),
        totalCost: item.totalCost.toString(),
        receivedQuantity: item.receivedQuantity?.toString() ?? '0',
      })),
    };
  }
}
