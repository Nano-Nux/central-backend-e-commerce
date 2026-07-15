import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { SupplierInvoiceStatus } from '../../../generated/prisma/enums';
import { SystemEvents } from '../../common/constants/event.constants';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import { AccountingService } from '../accounting/accounting.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { CreateSupplierInvoiceDto } from '../purchase/dto/create-supplier-invoice.dto';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { SupplierInvoicesRepository } from './supplier-invoices.repository';

@Injectable()
export class SupplierInvoicesService {
  constructor(
    private readonly supplierInvoicesRepository: SupplierInvoicesRepository,
    private readonly suppliersService: SuppliersService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly accountingService: AccountingService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateSupplierInvoiceDto, context?: AuditContext) {
    await this.suppliersService.findOne(dto.supplierId);
    await this.purchaseOrdersService.findOne(dto.purchaseOrderId);

    const invoice = await this.supplierInvoicesRepository.transaction(
      async (transaction) => {
        const createdInvoice = await this.supplierInvoicesRepository.create(
          {
            supplier: { connect: { id: dto.supplierId } },
            purchaseOrder: { connect: { id: dto.purchaseOrderId } },
            totalAmount: new Prisma.Decimal(dto.totalAmount),
            status: SupplierInvoiceStatus.UNPAID,
          },
          transaction,
        );

        await this.accountingService.recordSupplierInvoice(
          {
            supplierInvoiceId: createdInvoice.id,
            amount: createdInvoice.totalAmount,
            eventKey: `supplier-invoice-created:${createdInvoice.id}:ap`,
          },
          context,
          transaction,
        );

        await this.eventBus.publish(
          SystemEvents.SUPPLIER_INVOICE_CREATED,
          {
            supplierInvoice: {
              id: createdInvoice.id,
              supplierId: dto.supplierId,
              purchaseOrderId: dto.purchaseOrderId,
              totalAmount: createdInvoice.totalAmount.toString(),
              status: createdInvoice.status,
            },
          },
          {
            userId: context?.actorId ?? undefined,
            source: 'purchase',
          },
          transaction,
        );

        return createdInvoice;
      },
    );
    this.auditService.logCreate(
      'SUPPLIER_INVOICE',
      invoice.id,
      { id: invoice.id, totalAmount: invoice.totalAmount.toString() },
      undefined,
      context,
    );

    return invoice;
  }

  findAll() {
    return this.supplierInvoicesRepository.findMany();
  }

  async findOne(id: string, transaction?: Prisma.TransactionClient) {
    const invoice = await this.supplierInvoicesRepository.findById(id, transaction);

    if (!invoice) {
      throw new NotFoundException('Supplier invoice not found');
    }

    return invoice;
  }

  updateStatus(
    id: string,
    status: SupplierInvoiceStatus,
    transaction?: Prisma.TransactionClient,
  ) {
    return this.supplierInvoicesRepository.updateStatus(id, status, transaction);
  }

  paidAmount(id: string, transaction?: Prisma.TransactionClient) {
    return this.supplierInvoicesRepository.paidAmount(id, transaction);
  }
}
