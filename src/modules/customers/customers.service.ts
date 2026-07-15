import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditContext, AuditService } from '../audit/audit.service';
import {
  normalizeEmail,
  normalizeOptionalToken,
  sanitizePlainText,
} from '../../common/utils/input-sanitizer.util';
import { CustomerActivitiesService } from '../customer-activities/customer-activities.service';
import { CreateCustomerDto } from '../crm/dto/create-customer.dto';
import { CustomerListQueryDto } from '../crm/dto/customer-list-query.dto';
import { UpdateCustomerDto } from '../crm/dto/update-customer.dto';
import {
  createPaginationMeta,
  normalizePagination,
} from '../shared/helpers/pagination.helper';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly customerActivitiesService: CustomerActivitiesService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, context?: AuditContext) {
    const customer = await this.customersRepository.create({
      name: sanitizePlainText(dto.name),
      phone: normalizeOptionalToken(dto.phone),
      email: normalizeEmail(dto.email),
      type: dto.type,
      userId: dto.userId,
    });

    this.auditService.logCreate(
      'CUSTOMER',
      customer.id,
      this.snapshot(customer),
      undefined,
      context,
    );
    await this.customerActivitiesService.recordActivity({
      customerId: customer.id,
      type: 'CUSTOMER_CREATED',
      description: 'Customer profile created',
      metadata: { customerId: customer.id },
    });

    return customer;
  }

  async findAll(query: CustomerListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where = this.customersRepository.buildWhere(query);
    const [customers, total] = await Promise.all([
      this.customersRepository.findMany({ where, skip, take }),
      this.customersRepository.count(where),
    ]);

    return {
      data: customers,
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async findOne(id: string) {
    const customer = await this.customersRepository.findById(id);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findOrders(id: string, page = 1, limit = 20) {
    await this.findOne(id);
    const pagination = normalizePagination(page, limit);
    const [data, total] = await this.customersRepository.findOrdersByCustomer(
      id,
      pagination.skip,
      pagination.take,
    );
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  async findMessages(id: string, page = 1, limit = 20) {
    await this.findOne(id);
    const pagination = normalizePagination(page, limit);
    const [data, total] = await this.customersRepository.findMessagesByCustomer(
      id,
      pagination.skip,
      pagination.take,
    );
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  async update(id: string, dto: UpdateCustomerDto, context?: AuditContext) {
    const before = await this.findOne(id);
    const customer = await this.customersRepository.update(id, {
      name: dto.name === undefined ? undefined : sanitizePlainText(dto.name),
      phone:
        dto.phone === undefined ? undefined : normalizeOptionalToken(dto.phone),
      email: dto.email === undefined ? undefined : normalizeEmail(dto.email),
      type: dto.type,
      userId: dto.userId,
    });

    this.auditService.logUpdate(
      'CUSTOMER',
      id,
      this.snapshot(before),
      this.snapshot(customer),
      undefined,
      context,
    );
    await this.customerActivitiesService.recordActivity({
      customerId: id,
      type: 'CUSTOMER_UPDATED',
      description: 'Customer profile updated',
      metadata: { customerId: id },
    });

    return customer;
  }

  async remove(id: string, context?: AuditContext) {
    const before = await this.findOne(id);
    const removed = await this.customersRepository.delete(id);
    this.auditService.logAction(
      'CUSTOMER_DELETED',
      'CUSTOMER',
      id,
      this.snapshot(before),
      undefined,
      undefined,
      context,
    );
    return removed;
  }

  private snapshot(customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    type: string;
  }) {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      type: customer.type,
    };
  }
}
