import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../../generated/prisma/client';
import { AccountType } from '../../../../generated/prisma/enums';
import { AuditContext, AuditService } from '../../audit/audit.service';
import { AccountsRepository } from './accounts.repository';

export const DEFAULT_ACCOUNT_CODES = {
  CASH: '1000',
  CARD_CLEARING: '1010',
  TRANSFER_CLEARING: '1020',
  ONLINE_CLEARING: '1030',
  ACCOUNTS_RECEIVABLE: '1100',
  INVENTORY: '1200',
  ACCOUNTS_PAYABLE: '2000',
  GOODS_RECEIVED_CLEARING: '2100',
  SALES_REVENUE: '4000',
  COST_OF_GOODS_SOLD: '5000',
  RETAINED_EARNINGS: '3000',
} as const;

const DEFAULT_ACCOUNTS = [
  {
    code: DEFAULT_ACCOUNT_CODES.CASH,
    name: 'Cash',
    type: AccountType.ASSET,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.CARD_CLEARING,
    name: 'Card Clearing',
    type: AccountType.ASSET,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.TRANSFER_CLEARING,
    name: 'Bank Transfer Clearing',
    type: AccountType.ASSET,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.ONLINE_CLEARING,
    name: 'Online Payment Clearing',
    type: AccountType.ASSET,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    name: 'Accounts Receivable',
    type: AccountType.ASSET,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.INVENTORY,
    name: 'Inventory',
    type: AccountType.ASSET,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.ACCOUNTS_PAYABLE,
    name: 'Accounts Payable',
    type: AccountType.LIABILITY,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.GOODS_RECEIVED_CLEARING,
    name: 'Goods Received Clearing',
    type: AccountType.LIABILITY,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.SALES_REVENUE,
    name: 'Sales Revenue',
    type: AccountType.INCOME,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    name: 'Cost of Goods Sold',
    type: AccountType.EXPENSE,
  },
  {
    code: DEFAULT_ACCOUNT_CODES.RETAINED_EARNINGS,
    name: 'Retained Earnings',
    type: AccountType.EQUITY,
  },
] as const;

export type CreateAccountInput = {
  name: string;
  code: string;
  type: AccountType;
  isActive?: boolean;
};

export type UpdateAccountInput = Partial<CreateAccountInput>;

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateAccountInput, context?: AuditContext) {
    try {
      const account = await this.accountsRepository.create({
        name: input.name,
        code: input.code,
        type: input.type,
        isActive: input.isActive ?? true,
      });

      this.auditService.logCreate(
        'ACCOUNT',
        account.id,
        this.accountSnapshot(account),
        undefined,
        context,
      );

      return account;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Account code already exists');
      }

      throw error;
    }
  }

  findByType(type: AccountType) {
    return this.accountsRepository.findByType(type);
  }

  findAll() {
    return this.accountsRepository.findMany();
  }

  findPage(input: { skip: number; take: number; type?: AccountType }) {
    return this.accountsRepository.findPage(input);
  }

  async findOne(id: string) {
    const account = await this.accountsRepository.findById(id);
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async update(id: string, input: UpdateAccountInput, context?: AuditContext) {
    const existing = await this.accountsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    try {
      const account = await this.accountsRepository.update(id, {
        name: input.name,
        code: input.code,
        type: input.type,
      });
      this.auditService.logUpdate(
        'ACCOUNT',
        id,
        this.accountSnapshot(existing),
        this.accountSnapshot(account),
        undefined,
        context,
      );
      return account;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Account code already exists');
      }
      throw error;
    }
  }

  async seedDefaultAccounts(context?: AuditContext) {
    const accounts = await Promise.all(
      DEFAULT_ACCOUNTS.map((account) =>
        this.accountsRepository.upsertByCode(account),
      ),
    );

    this.auditService.logAction(
      'ACCOUNT_DEFAULTS_SEEDED',
      'ACCOUNT',
      'DEFAULT_CHART_OF_ACCOUNTS',
      undefined,
      { count: accounts.length },
      undefined,
      context,
    );

    return accounts;
  }

  getByCode(code: string) {
    return this.accountsRepository.findByCode(code);
  }

  private accountSnapshot(account: {
    id: string;
    name: string;
    code: string;
    type: AccountType;
    isActive: boolean;
  }) {
    return {
      id: account.id,
      name: account.name,
      code: account.code,
      type: account.type,
      isActive: account.isActive,
    };
  }
}
