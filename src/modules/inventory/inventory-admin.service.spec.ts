import { ConflictException } from '@nestjs/common';

jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    Decimal: class Decimal {
      constructor(private readonly value: string | number) {}

      toString() {
        return String(this.value);
      }
    },
  },
  PrismaClient: class PrismaClient {},
}));

import { BarcodeOwnerType } from '../../../generated/prisma/enums';
import { InventoryAdminService } from './inventory-admin.service';

describe('InventoryAdminService barcode safeguards', () => {
  let service: InventoryAdminService;
  let prisma: any;
  let stockItemsService: any;
  let configurationService: any;
  let barcodeRegistryService: any;
  let unitsService: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      barcodeRegistry: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      stockItemUnit: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(),
      },
      inventoryAsset: {
        findUnique: jest.fn(),
      },
      inventoryBatch: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(prisma),
      ),
    };
    stockItemsService = {
      getById: jest.fn().mockResolvedValue({ id: 'stock-item-1' }),
    };
    configurationService = {
      getEffectiveConfiguration: jest.fn(),
    };
    barcodeRegistryService = {
      register: jest.fn(),
      lookup: jest.fn(),
    };
    unitsService = {};
    auditService = {
      logCreate: jest.fn(),
      logUpdate: jest.fn(),
      logAction: jest.fn(),
    };

    service = new InventoryAdminService(
      prisma,
      stockItemsService,
      configurationService,
      barcodeRegistryService,
      unitsService,
      auditService,
    );
  });

  it('rejects registering a second active stock item barcode when multiples are disabled', async () => {
    configurationService.getEffectiveConfiguration.mockResolvedValue({
      allowMultipleBarcodes: false,
    });
    prisma.barcodeRegistry.findFirst.mockResolvedValueOnce({ id: 'existing-barcode' });

    await expect(
      service.registerBarcode({
        code: 'ABC123',
        symbology: 'CODE128',
        ownerType: BarcodeOwnerType.STOCK_ITEM,
        ownerId: 'stock-item-1',
        stockItemId: 'stock-item-1',
      }),
    ).rejects.toThrow(
      new ConflictException(
        'Multiple active barcodes are disabled for the resolved stock item',
      ),
    );
  });

  it('allows barcode replacement reactivation checks to ignore the barcode being activated', async () => {
    prisma.barcodeRegistry.findUnique.mockResolvedValue({
      id: 'barcode-1',
      ownerType: BarcodeOwnerType.STOCK_ITEM,
      ownerId: 'stock-item-1',
      productId: null,
      variantId: null,
      stockItemId: 'stock-item-1',
      stockItemUnitId: null,
      inventoryAssetId: null,
      inventoryBatchId: null,
    });
    configurationService.getEffectiveConfiguration.mockResolvedValue({
      allowMultipleBarcodes: false,
    });
    prisma.barcodeRegistry.findFirst.mockResolvedValueOnce(null);
    prisma.barcodeRegistry.update.mockResolvedValue({
      id: 'barcode-1',
      isActive: true,
    });

    await expect(service.activateBarcode('barcode-1')).resolves.toEqual({
      id: 'barcode-1',
      isActive: true,
    });
  });
});
