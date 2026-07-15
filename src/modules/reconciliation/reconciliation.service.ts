import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  InventoryMovementType,
  InventoryReconciliationExceptionStatus,
  InventoryReconciliationExceptionType,
  InventoryReferenceType,
  OrderStatus,
  OutboxEventStatus,
  PaymentStatus,
} from '../../../generated/prisma/enums';
import { eventNameCandidates } from '../../common/constants/event.constants';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { AuditContext } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { TriggerService } from '../triggers/trigger.service';
import { createPaginationMeta, normalizePagination } from '../shared/helpers/pagination.helper';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const WORKFLOW_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const RECONCILIATION_BATCH_SIZE = 500;

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private intervalHandle?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly accountingService: AccountingService,
    private readonly triggerService: TriggerService,
  ) {}

  async onModuleInit() {
    await this.runScheduledCycle('startup');
    this.intervalHandle = setInterval(() => {
      void this.runScheduledCycle('schedule');
    }, FIVE_MINUTES_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  async listInventoryExceptions(status?: InventoryReconciliationExceptionStatus, page = 1, limit = 20) {
    const pagination = normalizePagination(page, limit);
    const where = status ? { status } : undefined;
    const [data, total] = await Promise.all([
      this.prisma.inventoryReconciliationException.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.inventoryReconciliationException.count({ where }),
    ]);
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  async resolveInventoryException(id: string, context?: AuditContext) {
    const existing = await this.prisma.inventoryReconciliationException.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Inventory reconciliation exception not found');
    }

    if (existing.status === InventoryReconciliationExceptionStatus.RESOLVED) {
      return existing;
    }

    return this.prisma.inventoryReconciliationException.update({
      where: { id },
      data: {
        status: InventoryReconciliationExceptionStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy: context?.actorId ?? null,
      },
    });
  }

  async runScheduledCycle(trigger: 'startup' | 'schedule' = 'schedule') {
    if (this.running) {
      this.logger.warn(
        `Skipping reconciliation cycle because a previous run is still active (${trigger})`,
      );
      return;
    }

    this.running = true;

    try {
      await this.reconcilePurchaseReceiptInventory();
      await this.reconcileAccountingEntries();
      await this.reconcileOrderInventoryExceptions();
      await this.reconcileRefundInventoryExceptions();
      await this.replayWorkflowTriggers();
      this.logger.log(`Reconciliation cycle completed (${trigger})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Reconciliation cycle failed (${trigger}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private async reconcilePurchaseReceiptInventory() {
    const receipts = await this.prisma.goodsReceipt.findMany({
      include: {
        items: true,
      },
      orderBy: {
        receivedAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const receipt of receipts) {
      for (const item of receipt.items) {
        const movementEventKey = `purchase-received:${receipt.id}:${item.id}:stock-in`;
        const existingMovement = await this.prisma.inventoryMovement.findUnique({
          where: { eventKey: movementEventKey },
          select: { id: true },
        });

        if (existingMovement) {
          await this.resolveExceptionByKey(
            `inventory:purchase-stock-in-repair-failed:${receipt.id}:${item.id}`,
          );
          continue;
        }

        try {
          await this.inventoryService.stockIn({
            productId: item.productId,
            batchCode: item.batchCode ?? `GR-${receipt.id}-${item.productId}`,
            stockItemId: item.stockItemId ?? undefined,
            unitId: item.unitId ?? undefined,
            eventKey: movementEventKey,
            quantity: item.quantity,
            unitCost: item.unitCost,
            expiryDate: item.expiryDate,
            referenceType: InventoryReferenceType.PURCHASE,
            referenceId: receipt.id,
          });
          await this.resolveExceptionByKey(
            `inventory:purchase-stock-in-repair-failed:${receipt.id}:${item.id}`,
          );
        } catch (error) {
          await this.recordInventoryException({
            exceptionKey: `inventory:purchase-stock-in-repair-failed:${receipt.id}:${item.id}`,
            type:
              InventoryReconciliationExceptionType.PURCHASE_STOCK_IN_REPAIR_FAILED,
            entityType: 'GOODS_RECEIPT',
            entityId: receipt.id,
            productId: item.productId,
            payloadJson: {
              goodsReceiptId: receipt.id,
              goodsReceiptItemId: item.id,
              productId: item.productId,
              stockItemId: item.stockItemId ?? null,
              unitId: item.unitId ?? null,
              quantity: item.quantity.toString(),
              unitCost: item.unitCost.toString(),
              batchCode: item.batchCode ?? null,
              expiryDate: item.expiryDate?.toISOString() ?? null,
            },
            error,
          });
        }
      }
    }
  }

  private async reconcileAccountingEntries() {
    await this.reconcileOrderRevenueEntries();
    await this.reconcilePaymentEntries();
    await this.reconcileRefundEntries();
    await this.reconcileInventoryAccountingEntries();
    await this.reconcileGoodsReceiptAccountingEntries();
    await this.reconcileSupplierInvoiceAccountingEntries();
    await this.reconcileSupplierPaymentAccountingEntries();
  }

  private async reconcileOrderRevenueEntries() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.REFUNDED],
        },
        payments: {
          some: {
            status: PaymentStatus.SUCCESS,
            refundOfPaymentId: null,
          },
        },
      },
      select: {
        id: true,
        total: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const order of orders) {
      const eventKey = `order-paid:${order.id}:sale`;

      if (await this.hasJournalEntry(eventKey)) {
        continue;
      }

      await this.accountingService.recordOrderSale({
        orderId: order.id,
        amount: order.total,
        eventKey,
      });
    }
  }

  private async reconcilePaymentEntries() {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        refundOfPaymentId: null,
      },
      include: {
        order: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const payment of payments) {
      const eventKey = `payment-succeeded:${payment.id}:cash`;

      if (await this.hasJournalEntry(eventKey)) {
        continue;
      }

      await this.accountingService.recordPaymentReceived({
        paymentId: payment.id,
        orderId: payment.order.id,
        method: payment.method,
        amount: payment.amount,
        eventKey,
      });
    }
  }

  private async reconcileRefundEntries() {
    const refundPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        refundOfPaymentId: {
          not: null,
        },
      },
      include: {
        order: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const refundPayment of refundPayments) {
      const cashEventKey = `payment-refunded:${refundPayment.id}:cash-reversal`;
      const saleEventKey = `payment-refunded:${refundPayment.id}:sale-reversal`;
      const amount = refundPayment.amount.abs();

      if (!(await this.hasJournalEntry(cashEventKey))) {
        await this.accountingService.reversePaymentReceived({
          paymentId: refundPayment.id,
          orderId: refundPayment.order.id,
          method: refundPayment.method,
          amount,
          eventKey: cashEventKey,
        });
      }

      if (!(await this.hasJournalEntry(saleEventKey))) {
        await this.accountingService.reverseOrderSale({
          orderId: refundPayment.order.id,
          amount,
          eventKey: saleEventKey,
        });
      }
    }
  }

  private async reconcileInventoryAccountingEntries() {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        OR: [
          {
            type: InventoryMovementType.OUT,
            referenceType: InventoryReferenceType.ORDER,
          },
          {
            type: InventoryMovementType.IN,
            referenceType: InventoryReferenceType.RETURN,
          },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const movement of movements) {
      const amount = new Prisma.Decimal(movement.quantity).mul(
        movement.unitCost ?? 0,
      );

      if (
        movement.type === InventoryMovementType.OUT &&
        movement.referenceType === InventoryReferenceType.ORDER
      ) {
        const eventKey = `inventory-stock-out:${movement.id}:cogs`;

        if (await this.hasJournalEntry(eventKey)) {
          continue;
        }

        await this.accountingService.recordInventoryCogs({
          orderId: movement.referenceId,
          amount,
          eventKey,
          description: `COGS for order ${movement.referenceId}`,
        });
        continue;
      }

      const eventKey = `inventory-stock-in:${movement.id}:cogs-reversal`;

      if (await this.hasJournalEntry(eventKey)) {
        continue;
      }

      await this.accountingService.reverseInventoryCogs({
        orderId: movement.referenceId,
        amount,
        eventKey,
        description: `Inventory return for refunded order ${movement.referenceId}`,
      });
    }
  }

  private async reconcileGoodsReceiptAccountingEntries() {
    const receipts = await this.prisma.goodsReceipt.findMany({
      include: {
        items: true,
      },
      orderBy: {
        receivedAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const receipt of receipts) {
      const eventKey = `purchase-received:${receipt.id}:inventory`;

      if (await this.hasJournalEntry(eventKey)) {
        continue;
      }

      const amount = receipt.items.reduce(
        (total, item) => total.plus(item.quantity.mul(item.unitCost)),
        new Prisma.Decimal(0),
      );

      await this.accountingService.recordGoodsReceived({
        goodsReceiptId: receipt.id,
        amount,
        eventKey,
      });
    }
  }

  private async reconcileSupplierInvoiceAccountingEntries() {
    const invoices = await this.prisma.supplierInvoice.findMany({
      orderBy: {
        id: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const invoice of invoices) {
      const eventKey = `supplier-invoice-created:${invoice.id}:ap`;

      if (await this.hasJournalEntry(eventKey)) {
        continue;
      }

      await this.accountingService.recordSupplierInvoice({
        supplierInvoiceId: invoice.id,
        amount: invoice.totalAmount,
        eventKey,
      });
    }
  }

  private async reconcileSupplierPaymentAccountingEntries() {
    const payments = await this.prisma.supplierPayment.findMany({
      orderBy: {
        paymentDate: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const payment of payments) {
      const eventKey = `supplier-payment-created:${payment.id}:cash`;

      if (await this.hasJournalEntry(eventKey)) {
        continue;
      }

      await this.accountingService.recordSupplierPayment({
        supplierPaymentId: payment.id,
        method: payment.paymentMethod,
        amount: payment.amount,
        eventKey,
      });
    }
  }

  private async reconcileOrderInventoryExceptions() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PAID, OrderStatus.COMPLETED],
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                isStockTracked: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.product.isStockTracked) {
          continue;
        }

        const movementEventKey = `order-paid:${order.id}:${item.id}:stock-out`;
        const exceptionKey = `inventory:missing-order-stock-out:${order.id}:${item.id}`;
        const movement = await this.prisma.inventoryMovement.findUnique({
          where: { eventKey: movementEventKey },
          select: { id: true },
        });

        if (movement) {
          await this.resolveExceptionByKey(exceptionKey);
          continue;
        }

        await this.recordInventoryException({
          exceptionKey,
          type: InventoryReconciliationExceptionType.MISSING_ORDER_STOCK_OUT,
          entityType: 'ORDER',
          entityId: order.id,
          productId: item.productId,
          payloadJson: {
            orderId: order.id,
            orderItemId: item.id,
            productId: item.productId,
            quantity: item.quantity.toString(),
            expectedEventKey: movementEventKey,
          },
        });
      }
    }
  }

  private async reconcileRefundInventoryExceptions() {
    const refundPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        refundOfPaymentId: {
          not: null,
        },
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    isStockTracked: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const refundPayment of refundPayments) {
      for (const item of refundPayment.order.items) {
        if (!item.product.isStockTracked) {
          continue;
        }

        const movementEventKey = `payment-refunded:${refundPayment.id}:${item.id}:restock`;
        const exceptionKey = `inventory:missing-refund-restock:${refundPayment.id}:${item.id}`;
        const movement = await this.prisma.inventoryMovement.findUnique({
          where: { eventKey: movementEventKey },
          select: { id: true },
        });

        if (movement) {
          await this.resolveExceptionByKey(exceptionKey);
          continue;
        }

        await this.recordInventoryException({
          exceptionKey,
          type: InventoryReconciliationExceptionType.MISSING_REFUND_RESTOCK,
          entityType: 'PAYMENT',
          entityId: refundPayment.id,
          productId: item.productId,
          payloadJson: {
            refundPaymentId: refundPayment.id,
            orderId: refundPayment.order.id,
            orderItemId: item.id,
            productId: item.productId,
            quantity: item.quantity.toString(),
            expectedEventKey: movementEventKey,
          },
        });
      }
    }
  }

  private async replayWorkflowTriggers() {
    const activeWorkflows = await this.prisma.workflow.findMany({
      where: {
        isActive: true,
      },
      select: {
        triggerEvent: true,
      },
      distinct: ['triggerEvent'],
    });

    if (!activeWorkflows.length) {
      return;
    }

    const triggerEventNames = new Set<string>();

    for (const workflow of activeWorkflows) {
      for (const candidate of eventNameCandidates(workflow.triggerEvent)) {
        triggerEventNames.add(candidate);
      }
    }

    const since = new Date(Date.now() - WORKFLOW_REPLAY_WINDOW_MS);
    const outboxEvents = await this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxEventStatus.PROCESSED,
        eventName: {
          in: Array.from(triggerEventNames),
        },
        processedAt: {
          gte: since,
        },
      },
      orderBy: {
        processedAt: 'asc',
      },
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const outboxEvent of outboxEvents) {
      await this.triggerService.dispatchMatchingWorkflows(
        outboxEvent.eventName,
        {
          eventId: outboxEvent.eventId,
          eventName: outboxEvent.eventName,
          timestamp: outboxEvent.occurredAt.toISOString(),
          payload: this.toInputJson(outboxEvent.payloadJson),
          metadata: this.toInputJson(outboxEvent.metadataJson),
        },
        {
          actorId: this.readUserId(outboxEvent.metadataJson),
        },
      );
    }
  }

  private async hasJournalEntry(eventKey: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { eventKey },
      select: { id: true },
    });

    return Boolean(entry);
  }

  private async recordInventoryException(input: {
    exceptionKey: string;
    type: InventoryReconciliationExceptionType;
    entityType: string;
    entityId: string;
    productId?: string;
    payloadJson?: Prisma.InputJsonValue;
    error?: unknown;
  }) {
    const message =
      input.error instanceof Error
        ? input.error.message.slice(0, 1000)
        : input.error
          ? String(input.error).slice(0, 1000)
          : null;

    await this.prisma.inventoryReconciliationException.upsert({
      where: {
        exceptionKey: input.exceptionKey,
      },
      update: {
        status: InventoryReconciliationExceptionStatus.OPEN,
        entityType: input.entityType,
        entityId: input.entityId,
        productId: input.productId ?? null,
        payloadJson: input.payloadJson,
        lastAttemptAt: new Date(),
        attempts: {
          increment: 1,
        },
        lastError: message,
        resolvedAt: null,
        resolvedBy: null,
      },
      create: {
        exceptionKey: input.exceptionKey,
        type: input.type,
        status: InventoryReconciliationExceptionStatus.OPEN,
        entityType: input.entityType,
        entityId: input.entityId,
        productId: input.productId ?? null,
        payloadJson: input.payloadJson,
        attempts: 1,
        lastAttemptAt: new Date(),
        lastError: message,
      },
    });
  }

  private async resolveExceptionByKey(exceptionKey: string) {
    const existing = await this.prisma.inventoryReconciliationException.findUnique({
      where: { exceptionKey },
      select: {
        id: true,
        status: true,
      },
    });

    if (
      !existing ||
      existing.status === InventoryReconciliationExceptionStatus.RESOLVED
    ) {
      return;
    }

    await this.prisma.inventoryReconciliationException.update({
      where: { id: existing.id },
      data: {
        status: InventoryReconciliationExceptionStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }

  private toInputJson(value: Prisma.JsonValue | null | undefined) {
    if (value === undefined || value === null) {
      return null;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private readUserId(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const metadata = value as Record<string, unknown>;

    return typeof metadata.userId === 'string' ? metadata.userId : undefined;
  }
}
