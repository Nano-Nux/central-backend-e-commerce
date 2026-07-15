import { Module } from '@nestjs/common';

import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { GoodsReceiptsController } from '../goods-receipts/goods-receipts.controller';
import { GoodsReceiptsRepository } from '../goods-receipts/goods-receipts.repository';
import { GoodsReceiptsService } from '../goods-receipts/goods-receipts.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchaseOrdersController } from '../purchase-orders/purchase-orders.controller';
import { PurchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { SupplierInvoicesController } from '../supplier-invoices/supplier-invoices.controller';
import { SupplierInvoicesRepository } from '../supplier-invoices/supplier-invoices.repository';
import { SupplierInvoicesService } from '../supplier-invoices/supplier-invoices.service';
import { SupplierPaymentsController } from '../supplier-payments/supplier-payments.controller';
import { SupplierPaymentsRepository } from '../supplier-payments/supplier-payments.repository';
import { SupplierPaymentsService } from '../supplier-payments/supplier-payments.service';
import { SuppliersController } from '../suppliers/suppliers.controller';
import { SuppliersRepository } from '../suppliers/suppliers.repository';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PurchaseReadService } from './purchase-read.service';

@Module({
  imports: [AccountingModule, AuditModule, InventoryModule],
  controllers: [
    SuppliersController,
    PurchaseOrdersController,
    GoodsReceiptsController,
    SupplierInvoicesController,
    SupplierPaymentsController,
  ],
  providers: [
    SuppliersService,
    SuppliersRepository,
    PurchaseOrdersService,
    PurchaseOrdersRepository,
    GoodsReceiptsService,
    GoodsReceiptsRepository,
    SupplierInvoicesService,
    SupplierInvoicesRepository,
    SupplierPaymentsService,
    SupplierPaymentsRepository,
    PurchaseReadService,
  ],
  exports: [
    SuppliersService,
    PurchaseOrdersService,
    GoodsReceiptsService,
    SupplierInvoicesService,
    SupplierPaymentsService,
  ],
})
export class PurchaseModule {}
