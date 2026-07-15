import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditContext, AuditService } from '../audit/audit.service';
import { CreateSupplierDto } from '../purchase/dto/create-supplier.dto';
import { UpdateSupplierDto } from '../purchase/dto/update-supplier.dto';
import { SuppliersRepository } from './suppliers.repository';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly suppliersRepository: SuppliersRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateSupplierDto, context?: AuditContext) {
    const supplier = await this.suppliersRepository.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
    });

    this.auditService.logCreate(
      'SUPPLIER',
      supplier.id,
      supplier,
      undefined,
      context,
    );

    return supplier;
  }

  findAll() {
    return this.suppliersRepository.findMany();
  }

  async findOne(id: string) {
    const supplier = await this.suppliersRepository.findById(id);

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, context?: AuditContext) {
    const before = await this.findOne(id);
    const supplier = await this.suppliersRepository.update(id, dto);
    this.auditService.logUpdate('SUPPLIER', id, before, supplier, undefined, context);
    return supplier;
  }

  async remove(id: string, context?: AuditContext) {
    return this.update(id, { isActive: false }, context);
  }
}
