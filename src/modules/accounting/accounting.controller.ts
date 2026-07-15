import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';

import { Prisma } from '../../../generated/prisma/client';
import {
  AccountType,
  JournalReferenceType,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AccountsService } from './accounts/accounts.service';
import { JournalService } from './journal/journal.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

type RequestWithUser = Request & { user?: AuthenticatedUser };

class CreateAccountDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type!: AccountType;
}

class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;
}

class AccountQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AccountType })
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;
}

class JournalQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: JournalReferenceType })
  @IsEnum(JournalReferenceType)
  @IsOptional()
  referenceType?: JournalReferenceType;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  to?: string;
}

class CreateJournalLineDto {
  @ApiProperty()
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  debit?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  credit?: number;
}

class CreateJournalEntryDto {
  @ApiProperty({ enum: JournalReferenceType })
  @IsEnum(JournalReferenceType)
  referenceType!: JournalReferenceType;

  @ApiProperty()
  @IsString()
  referenceId!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ type: () => [CreateJournalLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}

class AccountingReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  to?: string;
}

class AccountingBalanceSheetQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  asOf?: string;
}

@ApiTags('Accounting')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Accountant')
export class AccountingController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly journalService: JournalService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(['accounting/accounts', 'accounts'])
  createAccount(@Body() dto: CreateAccountDto, @Req() req: RequestWithUser) {
    return this.accountsService.create(dto, this.context(req));
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(['accounting/accounts', 'accounts'])
  async findAccounts(@Query() query: AccountQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.accountsService.findPage({
      skip: (page - 1) * limit,
      take: limit,
      type: query.type,
    });
    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(['accounting/accounts/:id', 'accounts/:id'])
  findAccount(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.findOne(id);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Updated successfully', type: ApiSuccessResponseDto })
  @Patch(['accounting/accounts/:id', 'accounts/:id'])
  updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: RequestWithUser,
  ) {
    return this.accountsService.update(id, dto, this.context(req));
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(['accounting/journal-entries', 'journal-entries'])
  createJournalEntry(
    @Body() dto: CreateJournalEntryDto,
    @Req() req: RequestWithUser,
  ) {
    return this.journalService.createJournalEntry(dto, this.context(req));
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(['accounting/journal-entries', 'journal-entries'])
  async findJournalEntries(@Query() query: JournalQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.journalService.findPage({
      skip: (page - 1) * limit,
      take: limit,
      referenceType: query.referenceType,
      from: query.from ? this.rangeStart(query.from) : undefined,
      to: query.to ? this.rangeEnd(query.to) : undefined,
    });
    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(['accounting/journal-entries/:id', 'journal-entries/:id'])
  findJournalEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.journalService.findOne(id);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(['accounting/reports/trial-balance', 'reports/trial-balance'])
  async trialBalance(@Query() query: AccountingReportQueryDto) {
    const rows = await this.aggregateJournalLines(
      this.createdAtFilter(query),
    );

    const grouped = this.groupByAccount(rows);
    const page = this.paginateReportRows(grouped, query);
    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      data: page.data,
      pagination: page.pagination,
      totals: {
        debit: grouped.reduce((sum, row) => sum.plus(row.debit), new Prisma.Decimal(0)).toFixed(2),
        credit: grouped.reduce((sum, row) => sum.plus(row.credit), new Prisma.Decimal(0)).toFixed(2),
      },
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(['accounting/reports/profit-loss', 'reports/profit-loss'])
  async profitAndLoss(@Query() query: AccountingReportQueryDto) {
    const rows = await this.aggregateJournalLines(
      this.createdAtFilter(query),
      [AccountType.INCOME, AccountType.EXPENSE],
    );
    const grouped = this.groupByAccount(rows);
    const page = this.paginateReportRows(grouped, query);
    const income = page.data.filter((row) => row.type === AccountType.INCOME);
    const expenses = page.data.filter((row) => row.type === AccountType.EXPENSE);
    const allIncome = grouped.filter((row) => row.type === AccountType.INCOME);
    const allExpenses = grouped.filter((row) => row.type === AccountType.EXPENSE);
    const totalIncome = income.reduce(
      (sum, row) => sum.plus(new Prisma.Decimal(row.balance)),
      new Prisma.Decimal(0),
    );
    const totalExpenses = expenses.reduce(
      (sum, row) => sum.plus(new Prisma.Decimal(row.balance)),
      new Prisma.Decimal(0),
    );
    const fullIncome = allIncome.reduce(
      (sum, row) => sum.plus(new Prisma.Decimal(row.balance)),
      new Prisma.Decimal(0),
    );
    const fullExpenses = allExpenses.reduce(
      (sum, row) => sum.plus(new Prisma.Decimal(row.balance)),
      new Prisma.Decimal(0),
    );

    return {
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      pagination: page.pagination,
      income,
      expenses,
      totals: {
        income: fullIncome.toFixed(2),
        expenses: fullExpenses.toFixed(2),
        netProfit: fullIncome.minus(fullExpenses).toFixed(2),
        pageIncome: totalIncome.toFixed(2),
        pageExpenses: totalExpenses.toFixed(2),
      },
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(['accounting/reports/balance-sheet', 'reports/balance-sheet'])
  async balanceSheet(@Query() query: AccountingBalanceSheetQueryDto) {
    const rows = await this.aggregateJournalLines(
      this.createdAtFilter({ to: query.asOf }),
      [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY],
    );
    const grouped = this.groupByAccount(rows);
    const assets = grouped.filter((row) => row.type === AccountType.ASSET);
    const liabilities = grouped.filter(
      (row) => row.type === AccountType.LIABILITY,
    );
    const equity = grouped.filter((row) => row.type === AccountType.EQUITY);
    const profitAndLossRows = await this.aggregateJournalLines(
      this.createdAtFilter({ to: query.asOf }),
      [AccountType.INCOME, AccountType.EXPENSE],
    );
    const profitAndLoss = this.groupByAccount(profitAndLossRows);
    const netIncome = profitAndLoss.reduce(
      (sum, row) =>
        sum.plus(
          row.type === AccountType.INCOME
            ? new Prisma.Decimal(row.balance)
            : new Prisma.Decimal(row.balance).neg(),
        ),
      new Prisma.Decimal(0),
    );

    if (!netIncome.eq(0)) {
      equity.push({
        accountId: 'CURRENT_PERIOD_EARNINGS',
        code: '3999',
        name: 'Current Period Earnings',
        type: AccountType.EQUITY,
        debit: netIncome.lt(0) ? netIncome.abs().toFixed(2) : '0.00',
        credit: netIncome.gt(0) ? netIncome.toFixed(2) : '0.00',
        balance: netIncome.toFixed(2),
      });
    }

    const page = this.paginateReportRows([...assets, ...liabilities, ...equity], query);

    return {
      asOf: query.asOf ?? null,
      assets: page.data.filter((row) => row.type === AccountType.ASSET),
      liabilities: page.data.filter((row) => row.type === AccountType.LIABILITY),
      equity: page.data.filter((row) => row.type === AccountType.EQUITY),
      pagination: page.pagination,
      totals: {
        assets: this.sumBalances(assets),
        liabilities: this.sumBalances(liabilities),
        equity: this.sumBalances(equity),
      },
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(['accounting/reports/cash-flow', 'reports/cash-flow'])
  async cashFlow(@Query() query: AccountingReportQueryDto) {
    const rows = await this.aggregateJournalLines(
      this.createdAtFilter(query),
      undefined,
      ['1000', '1010', '1020', '1030'],
    );
    const grouped = this.groupByAccount(rows);
    const page = this.paginateReportRows(grouped, query);

    return {
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      accounts: page.data,
      pagination: page.pagination,
      totals: {
        netCashFlow: this.sumBalances(grouped),
      },
    };
  }

  private context(req: RequestWithUser) {
    return {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  private createdAtFilter(query: { from?: string; to?: string }) {
    if (!query.from && !query.to) {
      return undefined;
    }

    return {
      gte: query.from ? this.rangeStart(query.from) : undefined,
      lte: query.to ? this.rangeEnd(query.to) : undefined,
    };
  }

  private async aggregateJournalLines(
    createdAt: { gte?: Date; lte?: Date } | undefined,
    accountTypes?: AccountType[],
    accountCodes?: string[],
  ) {
    const accounts = await this.prisma.account.findMany({
      where: {
        type: accountTypes ? { in: accountTypes } : undefined,
        code: accountCodes ? { in: accountCodes } : undefined,
      },
      orderBy: { code: 'asc' },
    });

    if (accounts.length === 0) return [];

    const totals = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: accounts.map((account) => account.id) },
        journalEntry: { createdAt },
      },
      _sum: { debit: true, credit: true },
    });
    const totalsByAccount = new Map(totals.map((row) => [row.accountId, row]));

    return accounts.map((account) => {
      const total = totalsByAccount.get(account.id);
      return {
        account,
        debit: total?._sum.debit ?? new Prisma.Decimal(0),
        credit: total?._sum.credit ?? new Prisma.Decimal(0),
      };
    });
  }

  private rangeStart(value: string) {
    const date = new Date(value);
    if (value.length === 10) date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private rangeEnd(value: string) {
    const date = new Date(value);
    if (value.length === 10) date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private groupByAccount(
    rows: Array<{
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      account: {
        id: string;
        code: string;
        name: string;
        type: AccountType;
      };
    }>,
  ) {
    const grouped = new Map<
      string,
      {
        accountId: string;
        code: string;
        name: string;
        type: AccountType;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
      }
    >();

    for (const row of rows) {
      const current =
        grouped.get(row.account.id) ??
        {
          accountId: row.account.id,
          code: row.account.code,
          name: row.account.name,
          type: row.account.type,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(0),
        };

      current.debit = current.debit.plus(row.debit);
      current.credit = current.credit.plus(row.credit);
      grouped.set(row.account.id, current);
    }

    return [...grouped.values()].map((row) => ({
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      type: row.type,
      debit: row.debit.toString(),
      credit: row.credit.toString(),
      balance: this.accountBalance(row.type, row.debit, row.credit).toFixed(2),
    }));
  }

  private accountBalance(
    type: AccountType,
    debit: Prisma.Decimal,
    credit: Prisma.Decimal,
  ) {
    if (type === AccountType.ASSET || type === AccountType.EXPENSE) {
      return debit.minus(credit);
    }

    return credit.minus(debit);
  }

  private sumBalances(rows: Array<{ balance: string }>) {
    return rows
      .reduce((sum, row) => sum.plus(row.balance), new Prisma.Decimal(0))
      .toFixed(2);
  }

  private paginateReportRows<T>(rows: T[], query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / limit),
      },
    };
  }
}
