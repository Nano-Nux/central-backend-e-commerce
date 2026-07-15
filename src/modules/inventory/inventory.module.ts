import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BarcodeRegistryRepository } from './barcode-registry.repository';
import { BarcodeRegistryService } from './barcode-registry.service';
import { BatchService } from '../inventory-batch/batch.service';
import { InventoryAdminController } from './inventory-admin.controller';
import { InventoryAdminService } from './inventory-admin.service';
import { InventoryAssetsRepository } from './inventory-assets.repository';
import { InventoryAssetsService } from './inventory-assets.service';
import { InventoryReadController } from './inventory-read.controller';
import { InventoryReadService } from './inventory-read.service';
import { InventoryIdentityResolverService } from './inventory-identity-resolver.service';
import { FifoService } from '../inventory-fifo/fifo.service';
import { InventoryOrderEventsHandler } from './inventory-order-events.handler';
import { InventoryPurchaseEventsHandler } from './inventory-purchase-events.handler';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import { StockItemConfigurationService } from './stock-item-configuration.service';
import { StockItemsRepository } from './stock-items.repository';
import { StockItemsService } from './stock-items.service';
import { UnitsRepository } from './units.repository';
import { UnitsService } from './units.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [
    InventoryController,
    InventoryAdminController,
    InventoryReadController,
  ],
  providers: [
    InventoryService,
    InventoryRepository,
    InventoryReadService,
    InventoryAdminService,
    InventoryIdentityResolverService,
    StockItemConfigurationService,
    StockItemsService,
    StockItemsRepository,
    UnitsService,
    UnitsRepository,
    BarcodeRegistryService,
    BarcodeRegistryRepository,
    InventoryAssetsService,
    InventoryAssetsRepository,
    FifoService,
    BatchService,
    InventoryOrderEventsHandler,
    InventoryPurchaseEventsHandler,
  ],
  exports: [
    InventoryService,
    StockItemConfigurationService,
    InventoryIdentityResolverService,
    StockItemsService,
    UnitsService,
    BarcodeRegistryService,
    InventoryAssetsService,
  ],
})
export class InventoryModule {}
