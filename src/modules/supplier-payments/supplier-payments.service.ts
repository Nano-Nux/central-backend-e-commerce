import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { SupplierInvoiceStatus } from '../../../generated/prisma/enums';
import { SystemEvents } from '../../common/constants/event.constants';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import { AccountingService } from '../accounting/accounting.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { CreateSupplierPaymentDto } from '../purchase/dto/create-supplier-payment.dto';
import { SupplierInvoicesService } from '../supplier-invoices/supplier-invoices.service';
import { SupplierPaymentsRepository } from './supplier-payments.repository';

@Injectable()
export class SupplierPaymentsService {
  constructor(
    private readonly supplierPaymentsRepository: SupplierPaymentsRepository,
    private readonly supplierInvoicesService: SupplierInvoicesService,
    private readonly accountingService: AccountingService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateSupplierPaymentDto, context?: AuditContext) {
    const invoice = await this.supplierInvoicesService.findOne(
      dto.supplierInvoiceId,
    );
    const amount = new Prisma.Decimal(dto.amount);
    const { payment, status } = await this.supplierPaymentsRepository.transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT id
          FROM supplier_invoices
          WHERE id = ${invoice.id}
          FOR UPDATE
        `;

        const lockedInvoice = await this.supplierInvoicesService.findOne(
          invoice.id,
          transaction,
        );
        const paidBefore = await this.supplierInvoicesService.paidAmount(
          invoice.id,
          transaction,
        );

        if (paidBefore.plus(amount).gt(lockedInvoice.totalAmount)) {
          throw new BadRequestException(
            'Supplier payment exceeds invoice balance',
          );
        }

        const createdPayment = await this.supplierPaymentsRepository.create(
          {
            supplierInvoice: { connect: { id: invoice.id } },
            amount,
            paymentMethod: dto.paymentMethod,
            paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
          },
          transaction,
        );
        const paidAfter = paidBefore.plus(amount);
        const nextStatus = paidAfter.gte(lockedInvoice.totalAmount)
          ? SupplierInvoiceStatus.PAID
          : SupplierInvoiceStatus.PARTIAL;

        await this.supplierInvoicesService.updateStatus(
          invoice.id,
          nextStatus,
          transaction,
        );

        await this.accountingService.recordSupplierPayment(
          {
            supplierPaymentId: createdPayment.id,
            method: createdPayment.paymentMethod,
            amount: createdPayment.amount,
            eventKey: `supplier-payment-created:${createdPayment.id}:cash`,
          },
          context,
          transaction,
        );

        await this.eventBus.publish(
          SystemEvents.SUPPLIER_PAYMENT_CREATED,
          {
            supplierPayment: {
              id: createdPayment.id,
              supplierInvoiceId: invoice.id,
              amount: createdPayment.amount.toString(),
              paymentMethod: createdPayment.paymentMethod,
            },
          },
          {
            userId: context?.actorId ?? undefined,
            source: 'purchase',
          },
          transaction,
        );

        return { payment: createdPayment, status: nextStatus };
      },
    );
    this.auditService.logCreate(
      'SUPPLIER_PAYMENT',
      payment.id,
      { id: payment.id, amount: payment.amount.toString() },
      undefined,
      context,
    );

    return payment;
  }

  findAll() {
    return this.supplierPaymentsRepository.findMany();
  }

  async findOne(id: string) {
    const payment = await this.supplierPaymentsRepository.findById(id);
    if (!payment) {
      throw new BadRequestException('Supplier payment not found');
    }
    return payment;
  }
}
