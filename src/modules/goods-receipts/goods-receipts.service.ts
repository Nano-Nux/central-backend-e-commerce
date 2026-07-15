import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import { PurchaseOrderStatus } from '../../../generated/prisma/enums';
import { PurchaseReceivedEvent } from '../../infrastructure/event-bus/events/purchase-received.event';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { InventoryIdentityResolverService } from '../inventory/inventory-identity-resolver.service';
import { StockItemConfigurationService } from '../inventory/stock-item-configuration.service';
import { CreateGoodsReceiptDto } from '../purchase/dto/create-goods-receipt.dto';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { GoodsReceiptsRepository } from './goods-receipts.repository';

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly goodsReceiptsRepository: GoodsReceiptsRepository,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly inventoryIdentityResolver: InventoryIdentityResolverService,
    private readonly stockItemConfigurationService: StockItemConfigurationService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateGoodsReceiptDto, context?: AuditContext) {
    const requestKey =
      dto.idempotencyKey ?? this.buildRequestKey(dto, context?.actorId ?? null);
    const existingReceipt =
      await this.goodsReceiptsRepository.findByRequestKey(requestKey);

    if (existingReceipt) {
      return existingReceipt;
    }

    await this.purchaseOrdersService.findOne(dto.purchaseOrderId);

    let receiptTotal = new Prisma.Decimal(0);

    let receipt: Awaited<ReturnType<GoodsReceiptsRepository['create']>>;

    try {
      receipt = await this.goodsReceiptsRepository.transaction(async (transaction) => {
        const duplicatedReceipt =
          await this.goodsReceiptsRepository.findByRequestKey(
            requestKey,
            transaction,
          );

        if (duplicatedReceipt) {
          return duplicatedReceipt;
        }

        const purchaseOrder =
          await this.goodsReceiptsRepository.lockPurchaseOrderWithItems(
            dto.purchaseOrderId,
            transaction,
          );

        if (!purchaseOrder) {
          throw new NotFoundException('Purchase order not found');
        }

        if (
          purchaseOrder.status !== PurchaseOrderStatus.APPROVED &&
          purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
        ) {
          throw new BadRequestException(
            'Only approved purchase orders can receive goods',
          );
        }

        const purchaseItems = new Map<string, typeof purchaseOrder.items[number]>();

        for (const item of purchaseOrder.items) {
          const key = this.purchaseItemKey(item);

          if (purchaseItems.has(key)) {
            throw new BadRequestException(
              'Purchase order contains duplicate inventory identities and cannot be received safely',
            );
          }

          purchaseItems.set(key, item);
        }
        receiptTotal = new Prisma.Decimal(0);
        const resolvedItems = await Promise.all(
          dto.items.map(async (item) => {
            const quantity = new Prisma.Decimal(item.quantity);
            const resolvedIdentity =
              await this.inventoryIdentityResolver.resolveForWrite(
                {
                  productId: item.productId,
                  stockItemId: item.stockItemId,
                  unitId: item.unitId,
                  quantity,
                },
                transaction,
              );

            await this.stockItemConfigurationService.assertReceiptConfiguration({
              stockItemId: resolvedIdentity.stockItemId,
              unitId: resolvedIdentity.unitId,
              batchCode: item.batchCode,
              expiryDate: item.expiryDate,
            });

            return {
              ...item,
              quantity,
              stockItemId: resolvedIdentity.stockItemId,
              unitId: resolvedIdentity.unitId,
              baseQuantity: resolvedIdentity.baseQuantity,
            };
          }),
        );

        for (const item of resolvedItems) {
          const purchaseItem = purchaseItems.get(this.purchaseItemKey(item));

          if (!purchaseItem) {
            throw new BadRequestException(
              'Received inventory identity is not on purchase order',
            );
          }

          const remaining = purchaseItem.quantity.minus(
            purchaseItem.receivedQuantity,
          );

          if (item.quantity.gt(remaining)) {
            throw new BadRequestException(
              'Received quantity exceeds open quantity',
            );
          }

          receiptTotal = receiptTotal.plus(item.quantity.mul(item.unitCost));
        }

        const createdReceipt = await this.goodsReceiptsRepository.create(
          {
            requestKey,
            purchaseOrder: { connect: { id: dto.purchaseOrderId } },
            receiver: { connect: { id: dto.receivedBy } },
            items: {
              create: resolvedItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                stockItemId: item.stockItemId,
                unitId: item.unitId,
                baseQuantity: item.baseQuantity,
                unitCost: item.unitCost,
                batchCode: item.batchCode,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
              })),
            },
          },
          transaction,
        );

        for (const item of resolvedItems) {
          const purchaseItem = purchaseItems.get(this.purchaseItemKey(item))!;

          await this.goodsReceiptsRepository.updateReceivedQuantity(
            purchaseItem.id,
            item.quantity,
            transaction,
          );
        }

        const allReceived = purchaseOrder.items.every((item) => {
          const received = resolvedItems
            .filter(
              (receiptItem) =>
                this.purchaseItemKey(receiptItem) === this.purchaseItemKey(item),
            )
            .reduce(
              (total, receiptItem) => total.plus(receiptItem.quantity),
              item.receivedQuantity,
            );

          return received.gte(item.quantity);
        });
        await this.goodsReceiptsRepository.updatePurchaseOrderStatus(
          purchaseOrder.id,
          allReceived
            ? PurchaseOrderStatus.RECEIVED
            : PurchaseOrderStatus.PARTIALLY_RECEIVED,
          transaction,
        );

        await this.eventBus.publish(
          new PurchaseReceivedEvent(
            {
              goodsReceiptId: createdReceipt.id,
              purchaseOrderId: dto.purchaseOrderId,
              total: receiptTotal.toString(),
              items: createdReceipt.items.map((createdItem, index) => ({
                goodsReceiptItemId: createdItem.id,
                productId: resolvedItems[index].productId,
                stockItemId: resolvedItems[index].stockItemId ?? null,
                unitId: resolvedItems[index].unitId ?? null,
                quantity: resolvedItems[index].quantity.toString(),
                baseQuantity: (
                  resolvedItems[index].baseQuantity ?? resolvedItems[index].quantity
                ).toString(),
                unitCost: resolvedItems[index].unitCost.toString(),
                batchCode: resolvedItems[index].batchCode ?? null,
                expiryDate: resolvedItems[index].expiryDate
                  ? new Date(resolvedItems[index].expiryDate).toISOString()
                  : null,
                assets: resolvedItems[index].assets?.map((asset) => ({
                  assetTag: asset.assetTag ?? null,
                  identifiers: asset.identifiers.map((identifier) => ({
                    identifierTypeId: identifier.identifierTypeId,
                    typeCode: identifier.typeCode,
                    value: identifier.value,
                    isPrimary: identifier.isPrimary,
                  })),
                })),
              })),
            },
            {
              userId: context?.actorId ?? undefined,
              source: 'purchase',
            },
          ),
          transaction,
        );

        return createdReceipt;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicatedReceipt =
          await this.goodsReceiptsRepository.findByRequestKey(requestKey);

        if (duplicatedReceipt) {
          return duplicatedReceipt;
        }
      }

      throw error;
    }
    this.auditService.logCreate(
      'GOODS_RECEIPT',
      receipt.id,
      { id: receipt.id, purchaseOrderId: dto.purchaseOrderId },
      undefined,
      context,
    );

    return receipt;
  }

  findAll() {
    return this.goodsReceiptsRepository.findMany();
  }

  async findOne(id: string) {
    const receipt = await this.goodsReceiptsRepository.findById(id);

    if (!receipt) {
      throw new NotFoundException('Goods receipt not found');
    }

    return receipt;
  }

  private buildRequestKey(
    dto: CreateGoodsReceiptDto,
    actorId: string | null,
  ) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          actorId,
          purchaseOrderId: dto.purchaseOrderId,
          receivedBy: dto.receivedBy,
          items: dto.items
            .map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              batchCode: item.batchCode ?? null,
              expiryDate: item.expiryDate ?? null,
            }))
            .sort((left, right) =>
              `${left.productId}:${left.batchCode ?? ''}`.localeCompare(
                `${right.productId}:${right.batchCode ?? ''}`,
              ),
            ),
        }),
      )
      .digest('hex');
  }

  private purchaseItemKey(input: {
    productId: string;
    stockItemId?: string | null;
    unitId?: string | null;
  }) {
    return [
      input.productId,
      input.stockItemId ?? 'legacy-product',
      input.unitId ?? 'base-unit',
    ].join(':');
  }
}
