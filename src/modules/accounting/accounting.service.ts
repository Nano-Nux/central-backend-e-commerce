import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  JournalReferenceType,
  PaymentMethod,
} from '../../../generated/prisma/enums';
import { SystemEvents } from '../../common/constants/event.constants';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import { AuditContext } from '../audit/audit.service';
import {
  AccountsService,
  DEFAULT_ACCOUNT_CODES,
} from './accounts/accounts.service';
import { JournalService } from './journal/journal.service';

type DecimalInput = string | number | Prisma.Decimal;

@Injectable()
export class AccountingService implements OnModuleInit {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly journalService: JournalService,
    private readonly eventBus: EventBusService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAccounts();
  }

  seedDefaultAccounts(context?: AuditContext) {
    return this.accountsService.seedDefaultAccounts(context);
  }

  async recordOrderSale(
    input: {
      orderId: string;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toPositiveDecimal(input.amount, 'Order amount');
    const accountsReceivable = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    );
    const salesRevenue = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.SALES_REVENUE,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.ORDER,
        referenceId: input.orderId,
        eventKey: input.eventKey,
        description:
          input.description ?? `Sales revenue for order ${input.orderId}`,
        lines: [
          {
            accountId: accountsReceivable.id,
            debit: amount,
          },
          {
            accountId: salesRevenue.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'ORDER_SALE');

    return journalEntry;
  }

  async recordPaymentReceived(
    input: {
      paymentId: string;
      orderId: string;
      method: PaymentMethod;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toPositiveDecimal(input.amount, 'Payment amount');
    const cashAccount = await this.getRequiredAccount(
      this.accountCodeForPaymentMethod(input.method),
    );
    const accountsReceivable = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.PAYMENT,
        referenceId: input.paymentId,
        eventKey: input.eventKey,
        description:
          input.description ?? `Payment received for order ${input.orderId}`,
        lines: [
          {
            accountId: cashAccount.id,
            debit: amount,
          },
          {
            accountId: accountsReceivable.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'PAYMENT_RECEIVED');

    return journalEntry;
  }

  async reverseOrderSale(
    input: {
      orderId: string;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toPositiveDecimal(input.amount, 'Refund amount');
    const accountsReceivable = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    );
    const salesRevenue = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.SALES_REVENUE,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.ORDER,
        referenceId: input.orderId,
        eventKey: input.eventKey,
        description:
          input.description ??
          `Sales reversal for refunded order ${input.orderId}`,
        lines: [
          {
            accountId: salesRevenue.id,
            debit: amount,
          },
          {
            accountId: accountsReceivable.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'ORDER_REFUNDED');

    return journalEntry;
  }

  async reversePaymentReceived(
    input: {
      paymentId: string;
      orderId: string;
      method: PaymentMethod;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toPositiveDecimal(input.amount, 'Refund amount');
    const cashAccount = await this.getRequiredAccount(
      this.accountCodeForPaymentMethod(input.method),
    );
    const accountsReceivable = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.PAYMENT,
        referenceId: input.paymentId,
        eventKey: input.eventKey,
        description:
          input.description ?? `Refund paid for order ${input.orderId}`,
        lines: [
          {
            accountId: accountsReceivable.id,
            debit: amount,
          },
          {
            accountId: cashAccount.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'PAYMENT_REFUNDED');

    return journalEntry;
  }

  async recordInventoryCogs(
    input: {
      orderId: string;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toDecimal(input.amount, 'COGS amount');

    if (amount.lte(0)) {
      return null;
    }

    const cogs = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    );
    const inventory = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.INVENTORY,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.INVENTORY,
        referenceId: input.orderId,
        eventKey: input.eventKey,
        description: input.description ?? `COGS for order ${input.orderId}`,
        lines: [
          {
            accountId: cogs.id,
            debit: amount,
          },
          {
            accountId: inventory.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'INVENTORY_COGS');

    return journalEntry;
  }

  async reverseInventoryCogs(
    input: {
      orderId: string;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toDecimal(input.amount, 'Inventory return amount');

    if (amount.lte(0)) {
      return null;
    }

    const cogs = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    );
    const inventory = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.INVENTORY,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.INVENTORY,
        referenceId: input.orderId,
        eventKey: input.eventKey,
        description:
          input.description ??
          `COGS reversal for refunded order ${input.orderId}`,
        lines: [
          {
            accountId: inventory.id,
            debit: amount,
          },
          {
            accountId: cogs.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'INVENTORY_RETURN');

    return journalEntry;
  }

  async recordInventoryAdjustmentDecrease(
    input: {
      referenceId: string;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toDecimal(input.amount, 'Inventory adjustment amount');

    if (amount.lte(0)) {
      return null;
    }

    const cogs = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    );
    const inventory = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.INVENTORY,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.ADJUSTMENT,
        referenceId: input.referenceId,
        eventKey: input.eventKey,
        description:
          input.description ??
          `Inventory decrease adjustment ${input.referenceId}`,
        lines: [
          {
            accountId: cogs.id,
            debit: amount,
          },
          {
            accountId: inventory.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'INVENTORY_ADJUSTMENT_DECREASE');

    return journalEntry;
  }

  async recordInventoryAdjustmentIncrease(
    input: {
      referenceId: string;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toDecimal(input.amount, 'Inventory adjustment amount');

    if (amount.lte(0)) {
      return null;
    }

    const cogs = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    );
    const inventory = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.INVENTORY,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.ADJUSTMENT,
        referenceId: input.referenceId,
        eventKey: input.eventKey,
        description:
          input.description ??
          `Inventory increase adjustment ${input.referenceId}`,
        lines: [
          {
            accountId: inventory.id,
            debit: amount,
          },
          {
            accountId: cogs.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'INVENTORY_ADJUSTMENT_INCREASE');

    return journalEntry;
  }

  async recordGoodsReceived(
    input: {
      goodsReceiptId: string;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toPositiveDecimal(input.amount, 'Goods receipt amount');
    const inventory = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.INVENTORY,
    );
    const clearing = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.GOODS_RECEIVED_CLEARING,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.PURCHASE,
        referenceId: input.goodsReceiptId,
        eventKey: input.eventKey,
        description:
          input.description ??
          `Inventory received for goods receipt ${input.goodsReceiptId}`,
        lines: [
          {
            accountId: inventory.id,
            debit: amount,
          },
          {
            accountId: clearing.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'GOODS_RECEIVED');

    return journalEntry;
  }

  async recordSupplierInvoice(
    input: {
      supplierInvoiceId: string;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toPositiveDecimal(
      input.amount,
      'Supplier invoice amount',
    );
    const clearing = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.GOODS_RECEIVED_CLEARING,
    );
    const accountsPayable = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.ACCOUNTS_PAYABLE,
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.PURCHASE,
        referenceId: input.supplierInvoiceId,
        eventKey: input.eventKey,
        description:
          input.description ?? `Supplier invoice ${input.supplierInvoiceId}`,
        lines: [
          {
            accountId: clearing.id,
            debit: amount,
          },
          {
            accountId: accountsPayable.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'SUPPLIER_INVOICE');

    return journalEntry;
  }

  async recordSupplierPayment(
    input: {
      supplierPaymentId: string;
      method: PaymentMethod;
      amount: DecimalInput;
      eventKey?: string;
      description?: string;
    },
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    const amount = this.toPositiveDecimal(
      input.amount,
      'Supplier payment amount',
    );
    const accountsPayable = await this.getRequiredAccount(
      DEFAULT_ACCOUNT_CODES.ACCOUNTS_PAYABLE,
    );
    const cashAccount = await this.getRequiredAccount(
      this.accountCodeForPaymentMethod(input.method),
    );

    const journalEntry = await this.journalService.createJournalEntry(
      {
        referenceType: JournalReferenceType.PAYMENT,
        referenceId: input.supplierPaymentId,
        eventKey: input.eventKey,
        description:
          input.description ?? `Supplier payment ${input.supplierPaymentId}`,
        lines: [
          {
            accountId: accountsPayable.id,
            debit: amount,
          },
          {
            accountId: cashAccount.id,
            credit: amount,
          },
        ],
      },
      context,
      transaction,
    );
    this.emitJournalCreated(journalEntry, 'SUPPLIER_PAYMENT');

    return journalEntry;
  }

  private emitJournalCreated(
    journalEntry: {
      id: string;
      referenceType: JournalReferenceType;
      referenceId: string;
    },
    trigger: string,
  ) {
    void this.eventBus
      .emit(SystemEvents.JOURNAL_ENTRY_CREATED, {
        trigger,
        journalEntry: {
          id: journalEntry.id,
          referenceType: journalEntry.referenceType,
          referenceId: journalEntry.referenceId,
        },
      })
      .catch(() => undefined);
  }

  private async getRequiredAccount(code: string) {
    const account = await this.accountsService.getByCode(code);

    if (!account || !account.isActive) {
      throw new BadRequestException(
        `Required accounting account ${code} is not configured`,
      );
    }

    return account;
  }

  private accountCodeForPaymentMethod(method: PaymentMethod) {
    switch (method) {
      case PaymentMethod.CASH:
        return DEFAULT_ACCOUNT_CODES.CASH;
      case PaymentMethod.CARD:
        return DEFAULT_ACCOUNT_CODES.CARD_CLEARING;
      case PaymentMethod.TRANSFER:
        return DEFAULT_ACCOUNT_CODES.TRANSFER_CLEARING;
      case PaymentMethod.ONLINE:
        return DEFAULT_ACCOUNT_CODES.ONLINE_CLEARING;
      case PaymentMethod.QR_MANUAL:
        return DEFAULT_ACCOUNT_CODES.TRANSFER_CLEARING;
    }
  }

  private toPositiveDecimal(value: DecimalInput, fieldName: string) {
    const decimal = this.toDecimal(value, fieldName);

    if (decimal.lte(0)) {
      throw new BadRequestException(`${fieldName} must be greater than zero`);
    }

    return decimal;
  }

  private toDecimal(value: DecimalInput, fieldName: string) {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`${fieldName} must be a valid number`);
    }
  }
}
