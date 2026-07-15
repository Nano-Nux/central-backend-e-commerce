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

import { InventoryTransformationLineDirection } from '../../../generated/prisma/enums';
import { InventoryReadService } from './inventory-read.service';

describe('InventoryReadService transformation execution', () => {
  let service: InventoryReadService;
  let prisma: any;
  let transaction: any;
  let inventoryService: any;
  let auditService: any;

  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn(),
      inventoryTransformation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryTransformationLine: {
        update: jest.fn(),
      },
      inventoryMovement: {
        findMany: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(transaction),
      ),
      inventoryTransformation: {
        findUnique: jest.fn(),
      },
    };

    inventoryService = {
      stockInInTransaction: jest.fn(),
      stockOutInTransaction: jest.fn(),
    };

    auditService = {
      logAction: jest.fn(),
      logCreate: jest.fn(),
      listEntityHistory: jest.fn(),
    };

    service = new InventoryReadService(prisma, inventoryService, auditService);
  });

  it('executes every transformation line inside one transaction and persists resolved base quantities', async () => {
    transaction.inventoryTransformation.findUnique.mockResolvedValue({
      id: 'transformation-1',
      notes: null,
      lines: [
        {
          id: 'line-out',
          stockItemId: 'stock-item-1',
          unitId: 'unit-piece',
          direction: InventoryTransformationLineDirection.OUT,
          quantity: '2',
          unitCost: null,
          stockItem: {
            id: 'stock-item-1',
            productId: 'product-1',
            variantId: null,
          },
        },
        {
          id: 'line-in',
          stockItemId: 'stock-item-2',
          unitId: 'unit-pack',
          direction: InventoryTransformationLineDirection.IN,
          quantity: '1',
          unitCost: '12.50',
          stockItem: {
            id: 'stock-item-2',
            productId: 'product-2',
            variantId: 'variant-2',
          },
        },
      ],
    });
    transaction.inventoryMovement.findMany.mockResolvedValue([]);
    inventoryService.stockOutInTransaction.mockResolvedValue({
      movement: { id: 'movement-out', baseQuantity: '2.00000000' },
    });
    inventoryService.stockInInTransaction.mockResolvedValue({
      movement: { id: 'movement-in', baseQuantity: '6.00000000' },
    });
    transaction.inventoryTransformation.update.mockResolvedValue({
      id: 'transformation-1',
    });
    prisma.inventoryTransformation.findUnique.mockResolvedValue({
      id: 'transformation-1',
      notes: '[EXECUTED]',
      lines: [],
    });

    const result = await service.executeTransformation('transformation-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(inventoryService.stockOutInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        stockItemId: 'stock-item-1',
        referenceId: 'transformation-1',
      }),
      transaction,
    );
    expect(inventoryService.stockInInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        stockItemId: 'stock-item-2',
        referenceId: 'transformation-1',
      }),
      transaction,
    );
    expect(transaction.inventoryTransformationLine.update).toHaveBeenNthCalledWith(
      1,
      {
        where: { id: 'line-out' },
        data: { baseQuantity: '2.00000000' },
      },
    );
    expect(transaction.inventoryTransformationLine.update).toHaveBeenNthCalledWith(
      2,
      {
        where: { id: 'line-in' },
        data: { baseQuantity: '6.00000000' },
      },
    );
    expect(transaction.inventoryTransformation.update).toHaveBeenCalledWith({
      where: { id: 'transformation-1' },
      data: { notes: '[EXECUTED]' },
    });
    expect(auditService.logAction).toHaveBeenCalledWith(
      'EXECUTE',
      'INVENTORY_TRANSFORMATION',
      'transformation-1',
      { notes: null },
      { notes: '[EXECUTED]' },
    );
    expect(result).toEqual({
      id: 'transformation-1',
      notes: '[EXECUTED]',
      lines: [],
      status: 'EXECUTED',
    });
  });

  it('does not mark a transformation as executed when any line fails', async () => {
    transaction.inventoryTransformation.findUnique.mockResolvedValue({
      id: 'transformation-1',
      notes: null,
      lines: [
        {
          id: 'line-out',
          stockItemId: 'stock-item-1',
          unitId: null,
          direction: InventoryTransformationLineDirection.OUT,
          quantity: '1',
          unitCost: null,
          stockItem: {
            id: 'stock-item-1',
            productId: 'product-1',
            variantId: null,
          },
        },
      ],
    });
    transaction.inventoryMovement.findMany.mockResolvedValue([]);
    inventoryService.stockOutInTransaction.mockRejectedValue(new Error('boom'));

    await expect(service.executeTransformation('transformation-1')).rejects.toThrow(
      'boom',
    );

    expect(transaction.inventoryTransformation.update).not.toHaveBeenCalled();
    expect(auditService.logAction).not.toHaveBeenCalled();
  });
});
