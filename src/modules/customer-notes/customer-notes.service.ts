import { Injectable } from '@nestjs/common';

import { AuditContext, AuditService } from '../audit/audit.service';
import { CustomerActivitiesService } from '../customer-activities/customer-activities.service';
import { CreateCustomerNoteDto } from '../crm/dto/create-customer-note.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class CustomerNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerActivitiesService: CustomerActivitiesService,
    private readonly auditService: AuditService,
  ) {}

  async addNote(
    customerId: string,
    dto: CreateCustomerNoteDto,
    context?: AuditContext,
  ) {
    const note = await this.prisma.customerNote.create({
      data: {
        customerId,
        content: dto.content,
        createdBy: dto.createdBy,
      },
    });

    this.auditService.logCreate(
      'CUSTOMER_NOTE',
      note.id,
      { id: note.id, customerId },
      undefined,
      context,
    );
    await this.customerActivitiesService.recordActivity({
      customerId,
      type: 'NOTE_ADDED',
      description: 'Customer note added',
      metadata: { noteId: note.id },
    });

    return note;
  }

  listNotes(customerId: string) {
    return this.prisma.customerNote.findMany({
      where: { customerId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
