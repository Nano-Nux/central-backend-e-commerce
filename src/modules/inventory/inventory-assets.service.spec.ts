import { BadRequestException } from '@nestjs/common';

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

import { InventoryAssetStatus } from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import { InventoryAssetsService } from './inventory-assets.service';

describe('InventoryAssetsService', () => {
  let service: InventoryAssetsService;
  let repository: any;
  let stockItemsService: any;
  let configurationService: any;
  let auditService: any;

  beforeEach(() => {
    repository = {
      findIdentifierTypesByIds: jest.fn(),
      findIdentifierTypesByCodes: jest.fn(),
      findAssetsByIds: jest.fn(),
      findAssetsBySerialNumbers: jest.fn(),
    };
    stockItemsService = {
      getById: jest.fn(),
      ensureTracked: jest.fn(),
    };
    configurationService = {
      getEffectiveConfiguration: jest.fn(),
    };
    auditService = {
      logCreate: jest.fn(),
      logAction: jest.fn(),
    };

    service = new InventoryAssetsService(
      repository,
      stockItemsService,
      configurationService,
      auditService,
    );
  });

  it('enforces configured identifier rules and regex validation on receipt assets', async () => {
    configurationService.getEffectiveConfiguration.mockResolvedValue({
      stockItemId: 'stock-item-1',
      trackUniqueAssets: true,
      identifierRules: [
        {
          identifierTypeId: 'imei-type',
          name: 'IMEI',
          isRequired: true,
          minCount: 1,
          maxCount: 1,
        },
      ],
    });
    repository.findIdentifierTypesByIds.mockResolvedValue([
      {
        id: 'imei-type',
        code: 'IMEI',
        name: 'IMEI',
        validationRegex: '^\\d{15}$',
        isActive: true,
      },
    ]);
    repository.findIdentifierTypesByCodes.mockResolvedValue([]);

    await expect(
      service.validateReceiptAssets({
        stockItemId: 'stock-item-1',
        quantity: new Prisma.Decimal(1),
        assets: [
          {
            identifiers: [
              {
                identifierTypeId: 'imei-type',
                value: '12345',
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Identifier value does not match validation for IMEI',
      ),
    );
  });

  it('requires one selected asset per unit sold', async () => {
    await expect(
      service.resolveSaleAssetIds({
        productId: 'product-1',
        stockItemId: 'stock-item-1',
        quantity: new Prisma.Decimal(2),
        assetIds: ['asset-1'],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Unique asset tracked stock items require one asset per unit sold',
      ),
    );
  });

  it('rejects assets that do not belong to the resolved stock item', async () => {
    repository.findAssetsByIds.mockResolvedValue([
      {
        id: 'asset-1',
        stockItemId: 'different-stock-item',
        status: InventoryAssetStatus.AVAILABLE,
      },
    ]);

    await expect(
      service.resolveSaleAssetIds({
        productId: 'product-1',
        stockItemId: 'stock-item-1',
        quantity: new Prisma.Decimal(1),
        assetIds: ['asset-1'],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Selected asset does not belong to the resolved stock item',
      ),
    );
  });
});
