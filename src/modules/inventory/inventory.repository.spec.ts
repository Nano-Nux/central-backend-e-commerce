jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {},
  PrismaClient: class PrismaClient {},
}));

import { InventoryRepository } from './inventory.repository';

describe('InventoryRepository', () => {
  let repository: InventoryRepository;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      inventoryItem: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      inventoryBatch: {
        findMany: jest.fn(),
      },
    };

    repository = new InventoryRepository(prisma);
  });

  it('resolves stock item summaries by stockItemId when available', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'inventory-item' });

    await repository.findItemByIdentity({
      productId: 'product-1',
      stockItemId: 'stock-item-1',
    });

    expect(prisma.inventoryItem.findUnique).toHaveBeenCalledWith({
      where: {
        stockItemId: 'stock-item-1',
      },
    });
    expect(prisma.inventoryItem.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the legacy product row only when stockItemId is absent', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'inventory-item' });

    await repository.findItemByIdentity({
      productId: 'product-1',
    });

    expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        stockItemId: null,
      },
    });
    expect(prisma.inventoryItem.findUnique).not.toHaveBeenCalled();
  });

  it('filters expired FIFO candidates out of the expiring batch query', async () => {
    prisma.inventoryBatch.findMany.mockResolvedValue([]);
    const transaction = {
      inventoryBatch: prisma.inventoryBatch,
    };

    await repository.findExpiringFifoBatches(
      'product-1',
      transaction as never,
      'stock-item-1',
    );

    expect(prisma.inventoryBatch.findMany).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        stockItemId: 'stock-item-1',
        expiryDate: {
          gt: expect.any(Date),
        },
        quantityRemaining: {
          gt: 0,
        },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
  });
});
