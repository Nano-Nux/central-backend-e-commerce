import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditContext, AuditService } from '../audit/audit.service';
import { CustomerActivitiesService } from '../customer-activities/customer-activities.service';
import { CreateCustomerTagDto } from '../crm/dto/create-customer-tag.dto';
import { CustomerTagsRepository } from './customer-tags.repository';

@Injectable()
export class CustomerTagsService {
  constructor(
    private readonly customerTagsRepository: CustomerTagsRepository,
    private readonly customerActivitiesService: CustomerActivitiesService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCustomerTagDto, context?: AuditContext) {
    const tag = await this.customerTagsRepository.create({
      name: dto.name,
      color: dto.color,
    });

    this.auditService.logCreate(
      'CUSTOMER_TAG',
      tag.id,
      tag,
      undefined,
      context,
    );

    return tag;
  }

  findAll() {
    return this.customerTagsRepository.findMany();
  }

  async assign(customerId: string, tagId: string, context?: AuditContext) {
    const tag = await this.customerTagsRepository.findById(tagId);

    if (!tag) {
      throw new NotFoundException('Customer tag not found');
    }

    const tagMap = await this.customerTagsRepository.assign(customerId, tagId);

    this.auditService.logAction(
      'CUSTOMER_TAG_ASSIGNED',
      'CUSTOMER',
      customerId,
      undefined,
      { tagId },
      undefined,
      context,
    );
    await this.customerActivitiesService.recordActivity({
      customerId,
      type: 'TAG_ASSIGNED',
      description: `Tag assigned: ${tag.name}`,
      metadata: { tagId, tagName: tag.name },
    });

    return tagMap;
  }

  async remove(customerId: string, tagId: string, context?: AuditContext) {
    const tagMap = await this.customerTagsRepository.remove(customerId, tagId);

    this.auditService.logAction(
      'CUSTOMER_TAG_REMOVED',
      'CUSTOMER',
      customerId,
      { tagId },
      undefined,
      undefined,
      context,
    );
    await this.customerActivitiesService.recordActivity({
      customerId,
      type: 'TAG_REMOVED',
      description: 'Customer tag removed',
      metadata: { tagId },
    });

    return tagMap;
  }
}
