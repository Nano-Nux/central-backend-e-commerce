import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { SystemEvents } from '../../common/constants/event.constants';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import {
  InventoryMovementType,
  InventoryReferenceType,
  InventorySerialStatus,
} from '../../../generated/prisma/enums';
import { AuditContext, AuditService } from '../audit/audit.service';
import { FifoAllocation, FifoService } from '../inventory-fifo/fifo.service';
import {
  InventoryRepository,
  InventoryTransaction,
} from './inventory.repository';
import {
  InventoryAssetInput,
  InventoryAssetsService,
} from './inventory-assets.service';
import {
  InventoryIdentityResolverService,
  ResolvedInventoryIdentity,
} from './inventory-identity-resolver.service';
import { StockItemConfigurationService } from './stock-item-configuration.service';

type DecimalInput = string | number | Prisma.Decimal;
type InventoryItemRecord = Awaited<
  ReturnType<InventoryRepository['findItemByIdentity']>
>;
type InventoryBatchRecord = Awaited<
  ReturnType<InventoryRepository['createBatch']>
>;
type InventoryMovementRecord = Awaited<
  ReturnType<InventoryRepository['createMovement']>
>;
type StockInResult =
  | {
      beforeItem: InventoryItemRecord;
      item: InventoryItemRecord;
      batch: InventoryBatchRecord;
      movement: InventoryMovementRecord;
      alreadyProcessed?: false;
    }
  | {
      beforeItem: null;
      item: InventoryItemRecord;
      batch: null;
      movement: InventoryMovementRecord;
      alreadyProcessed: true;
    };
type StockOutResult =
  | {
      beforeItem: InventoryItemRecord;
      item: InventoryItemRecord;
      allocations: FifoAllocation[];
      movement: InventoryMovementRecord;
      alreadyProcessed?: false;
    }
  | {
      beforeItem: null;
      item: InventoryItemRecord;
      allocations: FifoAllocation[];
      movement: InventoryMovementRecord;
      alreadyProcessed: true;
    };
type ReservationResult = {
  beforeItem: InventoryItemRecord;
  item: InventoryItemRecord;
};

export type StockInInput = {
  productId: string;
  variantId?: string | null;
  stockItemId?: string | null;
  unitId?: string | null;
  batchCode: string;
  quantity: DecimalInput;
  unitCost: DecimalInput;
  eventKey?: string;
  manufactureDate?: Date | string | null;
  expiryDate?: Date | string | null;
  referenceType?: InventoryReferenceType;
  referenceId: string;
  serialNumbers?: string[];
  assets?: InventoryAssetInput[];
  metadata?: Prisma.InputJsonValue;
};

export type StockOutInput = {
  productId: string;
  variantId?: string | null;
  stockItemId?: string | null;
  unitId?: string | null;
  quantity: DecimalInput;
  eventKey?: string;
  referenceType?: InventoryReferenceType;
  referenceId: string;
  serialNumbers?: string[];
  assetIds?: string[];
  metadata?: Prisma.InputJsonValue;
};

export type StockAdjustmentInput = {
  productId: string;
  variantId?: string | null;
  stockItemId?: string | null;
  unitId?: string | null;
  quantityDelta: DecimalInput;
  referenceId: string;
  batchCode?: string;
  unitCost?: DecimalInput;
  reason?: string;
  serialNumbers?: string[];
  assetIds?: string[];
  assets?: InventoryAssetInput[];
  metadata?: Prisma.InputJsonValue;
};

export type StockReservationInput = {
  productId: string;
  variantId?: string | null;
  stockItemId?: string | null;
  unitId?: string | null;
  quantity: DecimalInput;
  referenceId: string;
  reservationKey: string;
  serialNumbers?: string[];
  assetIds?: string[];
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly fifoService: FifoService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
    private readonly inventoryIdentityResolver: InventoryIdentityResolverService,
    private readonly stockItemConfigurationService: StockItemConfigurationService,
    private readonly inventoryAssetsService: InventoryAssetsService,
  ) {}

  async stockIn(input: StockInInput, context?: AuditContext) {
    this.ensureReferenceId(input.referenceId);

    if (input.eventKey) {
      const existingMovement = await this.inventoryRepository.findMovementByEventKey(
        input.eventKey,
      );

      if (existingMovement) {
        return {
          beforeItem: null,
          item: await this.inventoryRepository.findItemByIdentity({
            productId: input.productId,
            stockItemId: input.stockItemId,
          }),
          batch: null,
          movement: existingMovement,
          alreadyProcessed: true,
        };
      }
    }

    let result: StockInResult;

    try {
      result = await this.inventoryRepository.transaction(
        (transaction) => this.stockInInTransaction(input, transaction),
      );
    } catch (error) {
      if (
        input.eventKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingMovement = await this.inventoryRepository.findMovementByEventKey(
          input.eventKey,
        );

        if (existingMovement) {
          return {
            beforeItem: null,
            item: await this.inventoryRepository.findItemByIdentity({
              productId: input.productId,
              stockItemId: input.stockItemId,
            }),
            batch: null,
            movement: existingMovement,
            alreadyProcessed: true,
          };
        }
      }

      throw error;
    }

    if ('alreadyProcessed' in result && result.alreadyProcessed) {
      return result;
    }

    this.auditService.logAction(
      'INVENTORY_STOCK_IN',
      'INVENTORY',
      input.productId,
      this.itemSnapshot(result.beforeItem),
      {
        item: this.itemSnapshot(result.item),
        batchId: result.batch!.id,
        movementId: result.movement.id,
      },
      input.metadata ?? undefined,
      context,
    );

    return result;
  }

  async stockInInTransaction(
    input: StockInInput,
    transaction: InventoryTransaction,
  ): Promise<StockInResult> {
    this.ensureReferenceId(input.referenceId);

    const quantity = this.toPositiveDecimal(input.quantity, 'Quantity');
    const unitCost = this.toNonNegativeDecimal(input.unitCost, 'Unit cost');
    this.ensureSerialCount(input.serialNumbers, quantity);

    if (input.eventKey) {
      const existingMovement = await this.inventoryRepository.findMovementByEventKey(
        input.eventKey,
        transaction,
      );

      if (existingMovement) {
        return {
          beforeItem: null,
          item: await this.inventoryRepository.findItemByIdentity(
            {
              productId: input.productId,
              stockItemId: input.stockItemId,
            },
            transaction,
          ),
          batch: null,
          movement: existingMovement,
          alreadyProcessed: true as const,
        };
      }
    }

    const resolvedIdentity = await this.resolveIdentity(input, transaction);
    await this.assertInboundConfiguration(resolvedIdentity, quantity, input);

    const beforeItem = await this.inventoryRepository.upsertItem(
      this.identityLookup(resolvedIdentity),
      transaction,
    );
    const batch = await this.inventoryRepository.createBatch(
      {
        productId: input.productId,
        stockItemId: resolvedIdentity.stockItemId,
        batchCode: input.batchCode,
        quantityReceived: resolvedIdentity.baseQuantity,
        quantityRemaining: resolvedIdentity.baseQuantity,
        unitCost,
        manufactureDate: this.toOptionalDate(input.manufactureDate),
        expiryDate: this.toOptionalDate(input.expiryDate),
      },
      transaction,
    );
    await this.inventoryRepository.incrementItemQuantity(
      this.identityLookup(resolvedIdentity),
      resolvedIdentity.baseQuantity,
      transaction,
    );
    await this.registerAssetsIfProvided(
      resolvedIdentity,
      batch.id,
      quantity,
      input.assets,
      transaction,
    );
    const movement = await this.inventoryRepository.createMovement(
      {
        productId: input.productId,
        stockItemId: resolvedIdentity.stockItemId,
        unitId: resolvedIdentity.unitId,
        type: InventoryMovementType.IN,
        eventKey: input.eventKey,
        quantity,
        baseQuantity: resolvedIdentity.baseQuantity,
        unitCost,
        referenceType: input.referenceType ?? InventoryReferenceType.PURCHASE,
        referenceId: input.referenceId,
      },
      transaction,
    );

    const item = await this.inventoryRepository.findItemByIdentity(
      this.identityLookup(resolvedIdentity),
      transaction,
    );

    await this.createSerialsIfProvided(input, resolvedIdentity, transaction);

    await this.eventBus.publish(
      SystemEvents.INVENTORY_STOCK_IN,
      {
        productId: input.productId,
        stockItemId: resolvedIdentity.stockItemId,
        unitId: resolvedIdentity.unitId,
        referenceType: input.referenceType ?? InventoryReferenceType.PURCHASE,
        referenceId: input.referenceId,
        quantity: quantity.toString(),
        baseQuantity: resolvedIdentity.baseQuantity.toString(),
        unitCost: unitCost.toString(),
        item: this.itemSnapshot(item),
        batchId: batch.id,
        movementId: movement.id,
      },
      undefined,
      transaction,
    );

    return { beforeItem, item, batch, movement };
  }

  async stockOut(input: StockOutInput, context?: AuditContext) {
    this.ensureReferenceId(input.referenceId);

    if (input.eventKey) {
      const existingMovement = await this.inventoryRepository.findMovementByEventKey(
        input.eventKey,
      );

      if (existingMovement) {
        return {
          beforeItem: null,
          item: await this.inventoryRepository.findItemByIdentity({
            productId: input.productId,
            stockItemId: input.stockItemId,
          }),
          allocations: [],
          movement: existingMovement,
          alreadyProcessed: true,
        };
      }
    }

    let result: StockOutResult;

    try {
      result = await this.inventoryRepository.transaction(
        (transaction) => this.stockOutInTransaction(input, transaction),
      );
    } catch (error) {
      if (
        input.eventKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingMovement = await this.inventoryRepository.findMovementByEventKey(
          input.eventKey,
        );

        if (existingMovement) {
          return {
            beforeItem: null,
            item: await this.inventoryRepository.findItemByIdentity({
              productId: input.productId,
              stockItemId: input.stockItemId,
            }),
            allocations: [],
            movement: existingMovement,
            alreadyProcessed: true,
          };
        }
      }

      throw error;
    }

    if ('alreadyProcessed' in result && result.alreadyProcessed) {
      return result;
    }

    this.auditService.logAction(
      'INVENTORY_STOCK_OUT',
      'INVENTORY',
      input.productId,
      this.itemSnapshot(result.beforeItem),
      {
        item: this.itemSnapshot(result.item),
        movementId: result.movement.id,
        allocations: this.allocationSnapshots(result.allocations),
      },
      input.metadata ?? undefined,
      context,
    );

    return result;
  }

  async stockOutInTransaction(
    input: StockOutInput,
    transaction: InventoryTransaction,
  ): Promise<StockOutResult> {
    this.ensureReferenceId(input.referenceId);

    const quantity = this.toPositiveDecimal(input.quantity, 'Quantity');
    this.ensureSerialCount(input.serialNumbers, quantity);

    if (input.eventKey) {
      const existingMovement = await this.inventoryRepository.findMovementByEventKey(
        input.eventKey,
        transaction,
      );

      if (existingMovement) {
        return {
          beforeItem: null,
          item: await this.inventoryRepository.findItemByIdentity(
            {
              productId: input.productId,
              stockItemId: input.stockItemId,
            },
            transaction,
          ),
          allocations: [],
          movement: existingMovement,
          alreadyProcessed: true as const,
        };
      }
    }

    const resolvedIdentity = await this.resolveIdentity(input, transaction);
    const assetIds = await this.resolveOutboundAssetIds(
      resolvedIdentity,
      quantity,
      input.assetIds,
      input.serialNumbers,
    );

    const beforeItem = await this.inventoryRepository.upsertItem(
      this.identityLookup(resolvedIdentity),
      transaction,
    );
    const allocations = await this.fifoService.consume(
      {
        productId: input.productId,
        quantity: resolvedIdentity.baseQuantity,
        stockItemId: resolvedIdentity.stockItemId,
      },
      transaction,
    );
    const itemUpdate = await this.inventoryRepository.decrementItemQuantity(
      this.identityLookup(resolvedIdentity),
      resolvedIdentity.baseQuantity,
      transaction,
    );

    if (itemUpdate.count !== 1) {
      throw new ConflictException('Inventory summary is out of sync');
    }

    await this.inventoryAssetsService.markAssetsSold(
      assetIds,
      input.referenceId,
      transaction,
    );

    if (input.serialNumbers?.length) {
      const serialUpdate = await this.inventoryRepository.markSerialsSold(
        input.productId,
        input.serialNumbers,
        input.referenceId,
        transaction,
        resolvedIdentity.stockItemId,
      );

      if (serialUpdate.count !== input.serialNumbers.length) {
        throw new ConflictException('One or more serial numbers are unavailable');
      }
    }

    const item = await this.inventoryRepository.findItemByIdentity(
      this.identityLookup(resolvedIdentity),
      transaction,
    );
    const movement = await this.inventoryRepository.createMovement(
      {
        productId: input.productId,
        stockItemId: resolvedIdentity.stockItemId,
        unitId: resolvedIdentity.unitId,
        type: InventoryMovementType.OUT,
        eventKey: input.eventKey,
        quantity,
        baseQuantity: resolvedIdentity.baseQuantity,
        unitCost: this.allocationCost(allocations),
        referenceType: input.referenceType ?? InventoryReferenceType.ORDER,
        referenceId: input.referenceId,
      },
      transaction,
    );

    await this.eventBus.publish(
      SystemEvents.INVENTORY_STOCK_OUT,
      {
        productId: input.productId,
        stockItemId: resolvedIdentity.stockItemId,
        unitId: resolvedIdentity.unitId,
        referenceType: input.referenceType ?? InventoryReferenceType.ORDER,
        referenceId: input.referenceId,
        quantity: quantity.toString(),
        baseQuantity: resolvedIdentity.baseQuantity.toString(),
        item: this.itemSnapshot(item),
        movementId: movement.id,
        allocations: this.allocationSnapshots(allocations),
      },
      undefined,
      transaction,
    );

    return { beforeItem, item, allocations, movement };
  }

  async adjustStock(input: StockAdjustmentInput, context?: AuditContext) {
    this.ensureReferenceId(input.referenceId);

    const quantityDelta = this.toDecimal(input.quantityDelta, 'Quantity delta');

    if (quantityDelta.eq(0)) {
      throw new BadRequestException('Quantity delta must not be zero');
    }

    const result = await this.inventoryRepository.transaction(
      async (transaction) => {
        const resolvedIdentity = await this.resolveIdentity(
          {
            productId: input.productId,
            variantId: input.variantId,
            stockItemId: input.stockItemId,
            unitId: input.unitId,
            quantity: quantityDelta.abs(),
          },
          transaction,
        );
        const adjustment = quantityDelta.abs();
        if (quantityDelta.gt(0)) {
          await this.assertInboundConfiguration(
            resolvedIdentity,
            adjustment,
            input,
          );
        }
        const assetIds = quantityDelta.lt(0)
          ? await this.resolveOutboundAssetIds(
              resolvedIdentity,
              adjustment,
              input.assetIds,
              input.serialNumbers,
            )
          : [];

        const beforeItem = await this.inventoryRepository.upsertItem(
          this.identityLookup(resolvedIdentity),
          transaction,
        );

        const signedBaseQuantity = quantityDelta.lt(0)
          ? resolvedIdentity.baseQuantity.neg()
          : resolvedIdentity.baseQuantity;
        const allocations = quantityDelta.lt(0)
          ? await this.fifoService.consume(
              {
                productId: input.productId,
                quantity: resolvedIdentity.baseQuantity,
                stockItemId: resolvedIdentity.stockItemId,
              },
              transaction,
            )
          : [];
        const batch = quantityDelta.gt(0)
          ? await this.inventoryRepository.createBatch(
              {
                productId: input.productId,
                stockItemId: resolvedIdentity.stockItemId,
                batchCode: input.batchCode ?? `ADJUSTMENT-${input.referenceId}`,
                quantityReceived: resolvedIdentity.baseQuantity,
                quantityRemaining: resolvedIdentity.baseQuantity,
                unitCost: this.toNonNegativeDecimal(
                  input.unitCost ?? 0,
                  'Unit cost',
                ),
              },
              transaction,
            )
          : null;

        if (quantityDelta.gt(0)) {
          await this.inventoryRepository.incrementItemQuantity(
            this.identityLookup(resolvedIdentity),
            resolvedIdentity.baseQuantity,
            transaction,
          );
          await this.registerAssetsIfProvided(
            resolvedIdentity,
            batch?.id ?? null,
            adjustment,
            input.assets,
            transaction,
          );
        } else {
          const itemUpdate =
            await this.inventoryRepository.decrementItemQuantity(
              this.identityLookup(resolvedIdentity),
              resolvedIdentity.baseQuantity,
              transaction,
            );

          if (itemUpdate.count !== 1) {
            throw new ConflictException('Inventory summary is out of sync');
          }

          await this.inventoryAssetsService.markAssetsSold(
            assetIds,
            input.referenceId,
            transaction,
          );
        }

        const item = await this.inventoryRepository.findItemByIdentity(
          this.identityLookup(resolvedIdentity),
          transaction,
        );
        const movement = await this.inventoryRepository.createMovement(
          {
            productId: input.productId,
            stockItemId: resolvedIdentity.stockItemId,
            unitId: resolvedIdentity.unitId,
            type: InventoryMovementType.ADJUSTMENT,
            quantity: quantityDelta,
            baseQuantity: signedBaseQuantity,
            unitCost: input.unitCost
              ? this.toNonNegativeDecimal(input.unitCost, 'Unit cost')
              : undefined,
            referenceType: InventoryReferenceType.ADJUSTMENT,
            referenceId: input.referenceId,
          },
          transaction,
        );

        await this.eventBus.publish(
          SystemEvents.INVENTORY_ADJUSTED,
          {
            productId: input.productId,
            stockItemId: resolvedIdentity.stockItemId,
            unitId: resolvedIdentity.unitId,
            referenceId: input.referenceId,
            quantity: quantityDelta.toString(),
            baseQuantity: signedBaseQuantity.toString(),
            item: this.itemSnapshot(item),
            batchId: batch?.id,
            movementId: movement.id,
            unitCost: movement.unitCost?.toString() ?? null,
            allocations: this.allocationSnapshots(allocations),
            reason: input.reason,
          },
          undefined,
          transaction,
        );

        return { beforeItem, item, allocations, batch, movement };
      },
    );

    this.auditService.logAction(
      'INVENTORY_ADJUSTMENT',
      'INVENTORY',
      input.productId,
      this.itemSnapshot(result.beforeItem),
      {
        item: this.itemSnapshot(result.item),
        batchId: result.batch?.id,
        movementId: result.movement.id,
        allocations: this.allocationSnapshots(result.allocations),
        reason: input.reason,
      },
      input.metadata ?? undefined,
      context,
    );

    return result;
  }

  async reserveStock(input: StockReservationInput, context?: AuditContext) {
    this.ensureReferenceId(input.referenceId);

    const quantity = this.toPositiveDecimal(input.quantity, 'Quantity');

    let result: ReservationResult;

    try {
      result = await this.inventoryRepository.transaction(
        async (transaction) => {
          const existingReservation =
            await this.inventoryRepository.findReservationByKey(
              input.reservationKey,
              transaction,
            );

          if (existingReservation) {
            const item = await this.inventoryRepository.findItemByIdentity(
              {
                productId: input.productId,
                stockItemId: input.stockItemId,
              },
              transaction,
            );

            return { beforeItem: item, item };
          }

          const resolvedIdentity = await this.resolveIdentity(input, transaction);
          const config =
            resolvedIdentity.stockItemId
              ? await this.stockItemConfigurationService.getEffectiveConfiguration(
                  resolvedIdentity.stockItemId,
                )
              : null;
          if (config && !config.trackReservations) {
            throw new BadRequestException(
              'Reservations are not enabled for this stock item',
            );
          }
          const assetIds = await this.resolveOutboundAssetIds(
            resolvedIdentity,
            quantity,
            input.assetIds,
            input.serialNumbers,
          );

          const beforeItem = await this.inventoryRepository.upsertItem(
            this.identityLookup(resolvedIdentity),
            transaction,
          );
          if (!beforeItem) {
            throw new ConflictException('Inventory summary is out of sync');
          }
          await this.inventoryRepository.createReservation(
            {
              productId: input.productId,
              stockItemId: resolvedIdentity.stockItemId,
              unitId: resolvedIdentity.unitId,
              referenceId: input.referenceId,
              reservationKey: input.reservationKey,
              quantity: resolvedIdentity.baseQuantity,
              baseQuantity: resolvedIdentity.baseQuantity,
              assetIds: assetIds.length ? (assetIds as Prisma.InputJsonValue) : undefined,
            } as Prisma.InventoryReservationUncheckedCreateInput,
            transaction,
          );
          const availableQuantity = beforeItem.quantityOnHand.minus(
            beforeItem.reservedQuantity,
          );

          if (availableQuantity.lt(resolvedIdentity.baseQuantity)) {
            throw new ConflictException(
              'Insufficient available stock to reserve',
            );
          }

          const itemUpdate = await this.inventoryRepository.reserveItemQuantity(
            this.identityLookup(resolvedIdentity),
            resolvedIdentity.baseQuantity,
            transaction,
          );

          if (itemUpdate !== 1) {
            throw new ConflictException(
              'Insufficient available stock to reserve',
            );
          }

          await this.inventoryAssetsService.reserveAssets(assetIds, transaction);

          const item = await this.inventoryRepository.findItemByIdentity(
            this.identityLookup(resolvedIdentity),
            transaction,
          );

          await this.eventBus.publish(
            SystemEvents.INVENTORY_RESERVED,
            {
              productId: input.productId,
              stockItemId: resolvedIdentity.stockItemId,
              unitId: resolvedIdentity.unitId,
              referenceId: input.referenceId,
              quantity: quantity.toString(),
              baseQuantity: resolvedIdentity.baseQuantity.toString(),
              item: this.itemSnapshot(item),
            },
            undefined,
            transaction,
          );

          return { beforeItem, item };
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const item = await this.inventoryRepository.findItemByProductId(
          input.productId,
        );

        return { beforeItem: item, item };
      }

      throw error;
    }

    this.auditService.logAction(
      'INVENTORY_RESERVED',
      'INVENTORY',
      input.productId,
      this.itemSnapshot(result.beforeItem),
      {
        item: this.itemSnapshot(result.item),
        referenceId: input.referenceId,
      },
      input.metadata ?? undefined,
      context,
    );

    return result;
  }

  async releaseReservedStock(
    input: StockReservationInput,
    context?: AuditContext,
  ) {
    this.ensureReferenceId(input.referenceId);

    const quantity = this.toPositiveDecimal(input.quantity, 'Quantity');

    const result = await this.inventoryRepository.transaction(
      async (transaction) => {
        const reservation = await this.inventoryRepository.findReservationByKey(
          input.reservationKey,
          transaction,
        );

        if (!reservation || reservation.status !== 'ACTIVE') {
          const item = await this.inventoryRepository.findItemByIdentity(
            {
              productId: input.productId,
              stockItemId: input.stockItemId,
            },
            transaction,
          );

          return { beforeItem: item, item };
        }

        const resolvedIdentity = await this.resolveIdentity(input, transaction);
        const reservationAssetIds = this.parseAssetIds(
          (reservation as { assetIds?: Prisma.JsonValue | null }).assetIds,
        );
        const assetIds = input.assetIds?.length
          ? input.assetIds
          : reservationAssetIds;

        const beforeItem = await this.inventoryRepository.upsertItem(
          this.identityLookup(resolvedIdentity),
          transaction,
        );
        const reservationUpdate =
          await this.inventoryRepository.releaseReservation(
            input.reservationKey,
            transaction,
          );

        if (reservationUpdate.count !== 1) {
          throw new ConflictException('Inventory reservation was updated concurrently');
        }

        const itemUpdate =
          await this.inventoryRepository.releaseReservedQuantity(
            {
              productId: input.productId,
              stockItemId:
                reservation?.stockItemId ?? resolvedIdentity.stockItemId,
            },
            reservation?.baseQuantity ?? resolvedIdentity.baseQuantity,
            transaction,
          );

        if (itemUpdate.count !== 1) {
          throw new ConflictException('Reserved stock is out of sync');
        }

        await this.inventoryAssetsService.releaseReservedAssets(
          assetIds,
          transaction,
        );

        const item = await this.inventoryRepository.findItemByIdentity(
          {
            productId: input.productId,
            stockItemId:
              reservation?.stockItemId ?? resolvedIdentity.stockItemId,
          },
          transaction,
        );

        await this.eventBus.publish(
          SystemEvents.INVENTORY_RESERVATION_RELEASED,
          {
            productId: input.productId,
            stockItemId: reservation?.stockItemId ?? resolvedIdentity.stockItemId,
            unitId: reservation?.unitId ?? resolvedIdentity.unitId,
            referenceId: input.referenceId,
            quantity: quantity.toString(),
            baseQuantity: (
              reservation?.baseQuantity ?? resolvedIdentity.baseQuantity
            ).toString(),
            item: this.itemSnapshot(item),
          },
          undefined,
          transaction,
        );

        return { beforeItem, item };
      },
    );

    this.auditService.logAction(
      'INVENTORY_RESERVATION_RELEASED',
      'INVENTORY',
      input.productId,
      this.itemSnapshot(result.beforeItem),
      {
        item: this.itemSnapshot(result.item),
        referenceId: input.referenceId,
      },
      input.metadata ?? undefined,
      context,
    );

    return result;
  }

  async stockOutAndReleaseReservation(
    stockOutInput: StockOutInput,
    reservationInput: StockReservationInput,
    context?: AuditContext,
  ) {
    const result = await this.inventoryRepository.transaction(async (transaction) => {
      const stockOut = await this.stockOutInTransaction(stockOutInput, transaction);
      const reservation = await this.inventoryRepository.findReservationByKey(
        reservationInput.reservationKey,
        transaction,
      );

      if (!reservation || reservation.status !== 'ACTIVE') {
        return stockOut;
      }

      const released = await this.inventoryRepository.releaseReservation(
        reservationInput.reservationKey,
        transaction,
      );

      if (released.count !== 1) {
        throw new ConflictException('Inventory reservation was updated concurrently');
      }

      const quantityReleased = reservation.baseQuantity ?? reservation.quantity;
      const itemUpdate = await this.inventoryRepository.releaseReservedQuantity(
        {
          productId: reservationInput.productId,
          stockItemId: reservation.stockItemId,
        },
        quantityReleased,
        transaction,
      );

      if (itemUpdate.count !== 1) {
        throw new ConflictException('Reserved stock is out of sync');
      }

      await this.inventoryAssetsService.releaseReservedAssets(
        this.parseAssetIds(reservation.assetIds),
        transaction,
      );

      await this.eventBus.publish(
        SystemEvents.INVENTORY_RESERVATION_RELEASED,
        {
          productId: reservationInput.productId,
          stockItemId: reservation.stockItemId,
          unitId: reservation.unitId,
          referenceId: reservationInput.referenceId,
          quantity: reservationInput.quantity.toString(),
          baseQuantity: quantityReleased.toString(),
          item: this.itemSnapshot(stockOut.item),
        },
        undefined,
        transaction,
      );

      return stockOut;
    });

    this.auditService.logAction(
      'INVENTORY_STOCK_OUT_AND_RESERVATION_RELEASED',
      'INVENTORY',
      stockOutInput.productId,
      undefined,
      { referenceId: stockOutInput.referenceId },
      stockOutInput.metadata,
      context,
    );

    return result;
  }

  getInventory(productId: string) {
    return this.inventoryRepository.findItemByProductId(productId);
  }

  getInventorySummary(input: { productId: string; stockItemId?: string }) {
    return this.inventoryRepository.findItemByIdentity(input);
  }

  async getAvailability(input: {
    productId: string;
    stockItemId?: string;
    unitId?: string;
  }) {
    const item = await this.inventoryRepository.findItemByIdentity({
      productId: input.productId,
      stockItemId: input.stockItemId,
    });

    if (!item) {
      return {
        productId: input.productId,
        stockItemId: input.stockItemId ?? null,
        unitId: input.unitId ?? null,
        quantityOnHand: '0',
        reservedQuantity: '0',
        availableQuantity: '0',
        baseQuantityOnHand: '0',
        baseReservedQuantity: '0',
        baseAvailableQuantity: '0',
      };
    }

    const baseAvailableQuantity = item.quantityOnHand.minus(item.reservedQuantity);
    let divisor = new Prisma.Decimal(1);

    if (input.stockItemId && input.unitId) {
      const stockItemUnit = await this.inventoryRepository.findStockItemUnit(
        input.stockItemId,
        input.unitId,
      );

      if (!stockItemUnit) {
        throw new BadRequestException(
          'Unit is not valid for the resolved stock item',
        );
      }

      divisor = stockItemUnit.conversionToBase;
    }

    return {
      productId: input.productId,
      stockItemId: input.stockItemId ?? null,
      unitId: input.unitId ?? null,
      quantityOnHand: item.quantityOnHand.div(divisor).toString(),
      reservedQuantity: item.reservedQuantity.div(divisor).toString(),
      availableQuantity: baseAvailableQuantity.div(divisor).toString(),
      baseQuantityOnHand: item.quantityOnHand.toString(),
      baseReservedQuantity: item.reservedQuantity.toString(),
      baseAvailableQuantity: baseAvailableQuantity.toString(),
    };
  }

  async restockOrderItemFromRefund(
    input: {
      productId: string;
      variantId?: string | null;
      stockItemId?: string | null;
      unitId?: string | null;
      baseQuantity?: string;
      quantity: string;
      orderId: string;
      serialNumbers?: string[];
      assetIds?: string[];
      eventKey?: string;
    },
    context?: AuditContext,
  ) {
    const resolvedIdentity = await this.resolveIdentity({
      productId: input.productId,
      variantId: input.variantId,
      stockItemId: input.stockItemId,
      unitId: input.unitId,
      quantity: input.quantity,
    });
    const movement = await this.inventoryRepository.findLatestMovementByReference(
      input.productId,
      InventoryReferenceType.ORDER,
      input.orderId,
      resolvedIdentity.stockItemId,
    );
    const latestBatch = await this.inventoryRepository.findLatestBatchWithCost(
      input.productId,
      resolvedIdentity.stockItemId,
    );

    if (input.serialNumbers?.length) {
      return this.inventoryRepository.transaction(async (transaction) => {
        const serialNumbers = input.serialNumbers ?? [];
        const quantity = this.toPositiveDecimal(input.quantity, 'Quantity');
        const unitCost = this.toNonNegativeDecimal(
          movement?.unitCost ?? latestBatch?.unitCost ?? 0,
          'Unit cost',
        );
        const beforeItem = await this.inventoryRepository.upsertItem(
          this.identityLookup(resolvedIdentity),
          transaction,
        );
        const batch = await this.inventoryRepository.createBatch(
          {
            productId: input.productId,
            stockItemId: resolvedIdentity.stockItemId,
            batchCode: `RETURN-${input.orderId}-${input.productId}`,
            quantityReceived: resolvedIdentity.baseQuantity,
            quantityRemaining: resolvedIdentity.baseQuantity,
            unitCost,
          },
          transaction,
        );
        await this.inventoryRepository.incrementItemQuantity(
          this.identityLookup(resolvedIdentity),
          resolvedIdentity.baseQuantity,
          transaction,
        );
        await this.inventoryAssetsService.restoreAssets(
          input.assetIds ?? [],
          transaction,
        );
        const serialUpdate = await this.inventoryRepository.markSerialsAvailable(
          input.productId,
          serialNumbers,
          transaction,
          resolvedIdentity.stockItemId,
        );

        if (serialUpdate.count !== serialNumbers.length) {
          throw new ConflictException(
            'One or more serial numbers could not be restored',
          );
        }

        const item = await this.inventoryRepository.findItemByIdentity(
          this.identityLookup(resolvedIdentity),
          transaction,
        );
        const inventoryMovement = await this.inventoryRepository.createMovement(
          {
            productId: input.productId,
            stockItemId: resolvedIdentity.stockItemId,
            unitId: resolvedIdentity.unitId,
            type: InventoryMovementType.IN,
            eventKey: input.eventKey,
            quantity,
            baseQuantity: resolvedIdentity.baseQuantity,
            unitCost,
            referenceType: InventoryReferenceType.RETURN,
            referenceId: input.orderId,
          },
          transaction,
        );

        this.auditService.logAction(
          'INVENTORY_STOCK_IN',
          'INVENTORY',
          input.productId,
          this.itemSnapshot(beforeItem),
          {
            item: this.itemSnapshot(item),
            batchId: batch.id,
            movementId: inventoryMovement.id,
          },
          {
            serialNumbers,
            orderId: input.orderId,
          },
          context,
        );

        await this.eventBus.publish(
          SystemEvents.INVENTORY_STOCK_IN,
          {
            productId: input.productId,
            stockItemId: resolvedIdentity.stockItemId,
            unitId: resolvedIdentity.unitId,
            referenceType: InventoryReferenceType.RETURN,
            referenceId: input.orderId,
            quantity: quantity.toString(),
            baseQuantity: resolvedIdentity.baseQuantity.toString(),
            unitCost: unitCost.toString(),
            item: this.itemSnapshot(item),
            batchId: batch.id,
            movementId: inventoryMovement.id,
          },
          undefined,
          transaction,
        );

        return { beforeItem, item, batch, movement: inventoryMovement };
      });
    }

    if (input.assetIds?.length) {
      await this.inventoryRepository.transaction(async (transaction) => {
        await this.inventoryAssetsService.restoreAssets(
          input.assetIds ?? [],
          transaction,
        );
      });
    }

    return this.stockIn(
      {
        productId: input.productId,
        variantId: input.variantId,
        stockItemId: resolvedIdentity.stockItemId,
        unitId: resolvedIdentity.unitId,
        batchCode: `RETURN-${input.orderId}-${input.productId}`,
        eventKey: input.eventKey,
        quantity: input.quantity,
        unitCost: movement?.unitCost ?? latestBatch?.unitCost ?? 0,
        referenceType: InventoryReferenceType.RETURN,
        referenceId: input.orderId,
      },
      context,
    );
  }

  private async createSerialsIfProvided(
    input: StockInInput,
    resolvedIdentity: ResolvedInventoryIdentity,
    transaction: InventoryTransaction,
  ) {
    if (!input.serialNumbers?.length || input.assets?.length) {
      return;
    }

    await this.inventoryRepository.createSerials(
      input.serialNumbers.map((serialNumber) => ({
        productId: input.productId,
        stockItemId: resolvedIdentity.stockItemId,
        serialNumber,
        status: InventorySerialStatus.AVAILABLE,
      })),
      transaction,
    );
  }

  private resolveIdentity(
    input: {
      productId: string;
      quantity: DecimalInput;
      variantId?: string | null;
      stockItemId?: string | null;
      unitId?: string | null;
    },
    transaction?: InventoryTransaction,
  ) {
    return this.inventoryIdentityResolver.resolveForWrite(input, transaction);
  }

  private identityLookup(
    resolvedIdentity: ResolvedInventoryIdentity,
  ): { productId: string; stockItemId?: string | null } {
    return {
      productId: resolvedIdentity.productId,
      stockItemId: resolvedIdentity.stockItemId,
    };
  }

  private async assertInboundConfiguration(
    resolvedIdentity: ResolvedInventoryIdentity,
    quantity: Prisma.Decimal,
    input: {
      unitId?: string | null;
      batchCode?: string;
      expiryDate?: string | Date | null;
      referenceType?: InventoryReferenceType;
      serialNumbers?: string[];
      assets?: InventoryAssetInput[];
    },
  ) {
    if (!resolvedIdentity.stockItemId) {
      return null;
    }

    const config =
      await this.stockItemConfigurationService.assertReceiptConfiguration({
        stockItemId: resolvedIdentity.stockItemId,
        unitId: resolvedIdentity.unitId ?? input.unitId ?? null,
        batchCode: input.batchCode,
        expiryDate: input.expiryDate,
      });

    if (
      config?.trackUniqueAssets &&
      input.referenceType !== InventoryReferenceType.RETURN &&
      !input.serialNumbers?.length &&
      !(input.assets?.length)
    ) {
      throw new BadRequestException(
        'Unique asset tracked stock items require asset details on inbound stock',
      );
    }

    if (config?.trackUniqueAssets) {
      await this.inventoryAssetsService.validateReceiptAssets({
        stockItemId: resolvedIdentity.stockItemId,
        quantity,
        assets: input.assets,
      });
    }

    return config;
  }

  private async resolveOutboundAssetIds(
    resolvedIdentity: ResolvedInventoryIdentity,
    quantity: Prisma.Decimal,
    assetIds?: string[],
    serialNumbers?: string[],
  ) {
    if (!resolvedIdentity.stockItemId) {
      return [];
    }

    const config =
      await this.stockItemConfigurationService.getEffectiveConfiguration(
        resolvedIdentity.stockItemId,
      );

    if (!config.trackUniqueAssets) {
      return [];
    }

    return this.inventoryAssetsService.resolveSaleAssetIds({
      productId: resolvedIdentity.productId,
      stockItemId: resolvedIdentity.stockItemId,
      quantity,
      assetIds,
      serialNumbers,
    });
  }

  private async registerAssetsIfProvided(
    resolvedIdentity: ResolvedInventoryIdentity,
    batchId: string | null,
    quantity: Prisma.Decimal,
    assets: InventoryAssetInput[] | undefined,
    transaction: InventoryTransaction,
  ) {
    if (!resolvedIdentity.stockItemId || !batchId) {
      return [];
    }

    return this.inventoryAssetsService.registerAssetsForReceipt(
      {
        stockItemId: resolvedIdentity.stockItemId,
        batchId,
        quantity,
        assets,
      },
      transaction,
    );
  }

  private parseAssetIds(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private allocationCost(allocations: FifoAllocation[]) {
    if (!allocations.length) {
      return undefined;
    }

    const totalQuantity = allocations.reduce(
      (sum, allocation) => sum.plus(allocation.quantity),
      new Prisma.Decimal(0),
    );
    const totalCost = allocations.reduce(
      (sum, allocation) =>
        sum.plus(allocation.quantity.mul(allocation.unitCost)),
      new Prisma.Decimal(0),
    );

    if (totalQuantity.eq(0)) {
      return undefined;
    }

    return totalCost.div(totalQuantity);
  }

  private toDecimal(value: DecimalInput, fieldName: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`${fieldName} must be a valid number`);
    }
  }

  private toPositiveDecimal(
    value: DecimalInput,
    fieldName: string,
  ): Prisma.Decimal {
    const decimal = this.toDecimal(value, fieldName);

    if (decimal.lte(0)) {
      throw new BadRequestException(`${fieldName} must be greater than zero`);
    }

    return decimal;
  }

  private toNonNegativeDecimal(
    value: DecimalInput,
    fieldName: string,
  ): Prisma.Decimal {
    const decimal = this.toDecimal(value, fieldName);

    if (decimal.lt(0)) {
      throw new BadRequestException(`${fieldName} must be zero or greater`);
    }

    return decimal;
  }

  private toOptionalDate(value?: Date | string | null) {
    if (!value) {
      return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Date value is invalid');
    }

    return date;
  }

  private ensureReferenceId(referenceId: string) {
    if (!referenceId?.trim()) {
      throw new BadRequestException('Reference ID is required');
    }
  }

  private ensureSerialCount(
    serialNumbers: string[] | undefined,
    quantity: Prisma.Decimal,
  ) {
    if (!serialNumbers?.length) {
      return;
    }

    const quantityAsNumber = Number(quantity.toString());

    if (
      !Number.isSafeInteger(quantityAsNumber) ||
      quantityAsNumber !== serialNumbers.length
    ) {
      throw new BadRequestException('Serial number count must match quantity');
    }
  }

  private itemSnapshot(
    item: {
      quantityOnHand: Prisma.Decimal;
      reservedQuantity: Prisma.Decimal;
    } | null,
  ) {
    if (!item) {
      return null;
    }

    return {
      quantityOnHand: item.quantityOnHand.toString(),
      reservedQuantity: item.reservedQuantity.toString(),
    };
  }

  private allocationSnapshots(allocations: FifoAllocation[]) {
    return allocations.map((allocation) => ({
      batchId: allocation.batchId,
      quantity: allocation.quantity.toString(),
      unitCost: allocation.unitCost.toString(),
    }));
  }
}
