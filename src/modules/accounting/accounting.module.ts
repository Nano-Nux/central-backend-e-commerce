import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AccountingDomainEventsHandler } from './accounting-domain-events.handler';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountsRepository } from './accounts/accounts.repository';
import { AccountsService } from './accounts/accounts.service';
import { JournalRepository } from './journal/journal.repository';
import { JournalService } from './journal/journal.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [AccountingController],
  providers: [
    AccountingService,
    AccountsService,
    AccountsRepository,
    JournalService,
    JournalRepository,
    AccountingDomainEventsHandler,
  ],
  exports: [AccountingService, AccountsService, JournalService],
})
export class AccountingModule {}
