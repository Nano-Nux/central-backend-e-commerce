import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../../generated/prisma/client';
import { JournalReferenceType } from '../../../../generated/prisma/enums';
import { AuditContext, AuditService } from '../../audit/audit.service';
import { JournalRepository } from './journal.repository';

type DecimalInput = string | number | Prisma.Decimal;

export type JournalLineInput = {
  accountId: string;
  debit?: DecimalInput;
  credit?: DecimalInput;
};

export type CreateJournalEntryInput = {
  referenceType: JournalReferenceType;
  referenceId: string;
  eventKey?: string;
  description: string;
  lines: JournalLineInput[];
};

@Injectable()
export class JournalService {
  constructor(
    private readonly journalRepository: JournalRepository,
    private readonly auditService: AuditService,
  ) {}

  async createJournalEntry(
    input: CreateJournalEntryInput,
    context?: AuditContext,
    transaction?: Prisma.TransactionClient,
  ) {
    this.validateReference(input.referenceId);
    const lines = this.normalizeAndValidateLines(input.lines);

    const persistEntry = async (transactionClient: Prisma.TransactionClient) => {
      if (input.eventKey) {
        const existing = await this.journalRepository.findByEventKey(
          input.eventKey,
          transactionClient,
        );

        if (existing) {
          return existing;
        }
      }

      try {
        return await this.journalRepository.createEntry(
          {
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            eventKey: input.eventKey,
            description: input.description,
            lines: {
              create: lines,
            },
          },
          transactionClient,
        );
      } catch (error) {
        if (
          input.eventKey &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existing = await this.journalRepository.findByEventKey(
            input.eventKey,
            transactionClient,
          );

          if (existing) {
            return existing;
          }
        }

        throw error;
      }
    };

    const journalEntry = transaction
      ? await persistEntry(transaction)
      : await this.journalRepository.transaction(persistEntry);

    this.auditService.logCreate(
      'JOURNAL_ENTRY',
      journalEntry.id,
      this.journalSnapshot(journalEntry),
      {
        referenceType: journalEntry.referenceType,
        referenceId: journalEntry.referenceId,
      },
      context,
    );

    return journalEntry;
  }

  findOne(id: string) {
    return this.journalRepository.findById(id);
  }

  findPage(input: {
    skip: number;
    take: number;
    referenceType?: JournalReferenceType;
    from?: Date;
    to?: Date;
  }) {
    return this.journalRepository.findPage(input);
  }

  private normalizeAndValidateLines(lines: JournalLineInput[]) {
    if (lines.length < 2) {
      throw new BadRequestException(
        'Journal entry requires at least two lines',
      );
    }

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    const normalizedLines = lines.map((line) => {
      const debit = this.toDecimal(line.debit ?? 0, 'Debit');
      const credit = this.toDecimal(line.credit ?? 0, 'Credit');
      const hasDebit = debit.gt(0);
      const hasCredit = credit.gt(0);

      if (debit.lt(0) || credit.lt(0)) {
        throw new BadRequestException('Debit and credit must be non-negative');
      }

      if (hasDebit === hasCredit) {
        throw new BadRequestException(
          'Each journal line must contain either debit or credit',
        );
      }

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      return {
        accountId: line.accountId,
        debit,
        credit,
      };
    });

    if (!totalDebit.eq(totalCredit)) {
      throw new BadRequestException('Journal entry debits must equal credits');
    }

    return normalizedLines;
  }

  private validateReference(referenceId: string) {
    if (!referenceId?.trim()) {
      throw new BadRequestException('Journal reference ID is required');
    }
  }

  private toDecimal(value: DecimalInput, fieldName: string) {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`${fieldName} must be a valid number`);
    }
  }

  private journalSnapshot(journalEntry: {
    id: string;
    referenceType: JournalReferenceType;
    referenceId: string;
    description: string;
    eventKey?: string | null;
    lines: Array<{
      accountId: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
    }>;
  }) {
    return {
      id: journalEntry.id,
      referenceType: journalEntry.referenceType,
      referenceId: journalEntry.referenceId,
      eventKey: journalEntry.eventKey ?? null,
      description: journalEntry.description,
      lines: journalEntry.lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
      })),
    };
  }
}
