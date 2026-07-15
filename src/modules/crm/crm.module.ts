import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CustomerActivitiesService } from '../customer-activities/customer-activities.service';
import { CustomerNotesService } from '../customer-notes/customer-notes.service';
import { CustomerTagsRepository } from '../customer-tags/customer-tags.repository';
import { CustomerTagsService } from '../customer-tags/customer-tags.service';
import { CustomersController } from '../customers/customers.controller';
import { CustomersRepository } from '../customers/customers.repository';
import { CustomersService } from '../customers/customers.service';
import { CrmOrderEventsHandler } from './crm-order-events.handler';

@Module({
  imports: [AuditModule],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomersRepository,
    CustomerTagsService,
    CustomerTagsRepository,
    CustomerNotesService,
    CustomerActivitiesService,
    CrmOrderEventsHandler,
  ],
  exports: [
    CustomersService,
    CustomerTagsService,
    CustomerNotesService,
    CustomerActivitiesService,
  ],
})
export class CrmModule {}
