import { BadRequestException } from '@nestjs/common';

jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    Decimal: class Decimal {
      private readonly numericValue: number;

      constructor(value: string | number) {
        this.numericValue = Number(value);
      }

      lte(value: number) {
        return this.numericValue <= value;
      }

      mul(value: number) {
        return new this.constructor(this.numericValue * Number(value));
      }
    },
  },
  PrismaClient: class PrismaClient {},
}));

import { InventoryIdentityResolverService } from './inventory-identity-resolver.service';

describe('InventoryIdentityResolverService', () => {
  it('rejects a stock item belonging to another variant', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          isActive: true,
          isStockTracked: true,
          isSerialized: false,
          variants: [{ id: 'variant-1' }],
        }),
      },
      stockItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'stock-item-2',
          productId: 'product-1',
          variantId: 'variant-2',
          isActive: true,
          trackInventory: true,
          trackingMode: 'SIMPLE',
        }),
      },
    };
    const service = new InventoryIdentityResolverService(prisma as never);

    await expect(
      service.resolveForWrite({
        productId: 'product-1',
        variantId: 'variant-1',
        stockItemId: 'stock-item-2',
        quantity: 1,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Stock item does not belong to the provided variant',
      ),
    );
  });

  it('rejects an explicitly inactive stock item instead of bypassing tracking', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          isActive: true,
          isStockTracked: true,
          isSerialized: false,
          variants: [],
        }),
      },
      stockItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'stock-item-1',
          productId: 'product-1',
          variantId: null,
          isActive: false,
          trackInventory: true,
          trackingMode: 'SIMPLE',
        }),
      },
    };
    const service = new InventoryIdentityResolverService(prisma as never);

    await expect(
      service.resolveForWrite({
        productId: 'product-1',
        stockItemId: 'stock-item-1',
        quantity: 1,
      }),
    ).rejects.toThrow('Stock item is inactive or not tracked');
  });
});
