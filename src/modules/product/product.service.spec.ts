jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    Decimal: class Decimal {
      constructor(private readonly value: string | number) {}

      plus(other: { toString(): string } | number) {
        return new (this.constructor as any)(
          Number(this.value) + Number(typeof other === 'number' ? other : other.toString()),
        );
      }

      toString() {
        return String(this.value);
      }
    },
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(message: string, options: { code: string }) {
        super(message);
        this.code = options.code;
      }
    },
  },
  PrismaClient: class PrismaClient {},
}));

import { ProductService } from './product.service';

describe('ProductService variant lifecycle', () => {
  let service: ProductService;
  let productRepository: any;
  let categoryRepository: any;
  let prisma: any;
  let stockItemsService: any;
  let auditService: any;

  beforeEach(() => {
    productRepository = {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    categoryRepository = {
      findById: jest.fn(),
    };
    prisma = {
      productVariant: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      stockItem: {
        updateMany: jest.fn(),
      },
    };
    stockItemsService = {
      getOrCreateFromProduct: jest.fn(),
    };
    auditService = {
      logCreate: jest.fn(),
      logUpdate: jest.fn(),
      logAction: jest.fn(),
      logDelete: jest.fn(),
    };

    service = new ProductService(
      productRepository,
      categoryRepository,
      prisma,
      stockItemsService,
      auditService,
    );
  });

  it('provisions a stock item when creating a tracked variant', async () => {
    productRepository.findById.mockResolvedValue({
      id: 'product-1',
      name: 'Phone',
      sku: 'PHONE',
      isStockTracked: true,
      inventoryItem: null,
    });
    prisma.productVariant.create.mockResolvedValue({
      id: 'variant-1',
      name: 'Black',
      sku: 'PHONE-BLK',
    });

    await service.createVariant('product-1', {
      name: 'Black',
      sku: 'PHONE-BLK',
      attributes: { color: 'black' },
    });

    expect(stockItemsService.getOrCreateFromProduct).toHaveBeenCalledWith({
      productId: 'product-1',
      productName: 'Phone',
      productSku: 'PHONE',
      variantId: 'variant-1',
      variantName: 'Black',
      variantSku: 'PHONE-BLK',
      trackInventory: true,
    });
  });

  it('provisions base and variant stock items when creating a tracked product', async () => {
    categoryRepository.findById.mockResolvedValue({
      id: 'category-1',
    });
    productRepository.create.mockResolvedValue({
      id: 'product-1',
      name: 'Phone',
      slug: 'phone-product-1',
      sku: 'PHONE',
      isStockTracked: true,
      variants: [
        {
          id: 'variant-1',
          name: 'Black',
          sku: 'PHONE-BLK',
        },
      ],
      inventoryItem: null,
    });

    await service.create({
      name: 'Phone',
      sku: 'PHONE',
      type: 'PHYSICAL' as never,
      categoryId: 'category-1',
      isStockTracked: true,
      variants: [
        {
          name: 'Black',
          sku: 'PHONE-BLK',
          attributes: { color: 'black' },
        },
      ],
    });

    expect(stockItemsService.getOrCreateFromProduct).toHaveBeenNthCalledWith(1, {
      productId: 'product-1',
      productName: 'Phone',
      productSku: 'PHONE',
      trackInventory: true,
    });
    expect(stockItemsService.getOrCreateFromProduct).toHaveBeenNthCalledWith(2, {
      productId: 'product-1',
      productName: 'Phone',
      productSku: 'PHONE',
      variantId: 'variant-1',
      variantName: 'Black',
      variantSku: 'PHONE-BLK',
      trackInventory: true,
    });
  });

  it('deactivates the variant and its stock item together', async () => {
    prisma.productVariant.findFirst.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      isActive: true,
    });
    prisma.productVariant.update.mockResolvedValue({
      id: 'variant-1',
      isActive: false,
    });

    await service.deactivateVariant('product-1', 'variant-1');

    expect(prisma.stockItem.updateMany).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        variantId: 'variant-1',
      },
      data: {
        isActive: false,
      },
    });
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: {
        isActive: false,
      },
    });
  });

  it('reactivates the variant and reprovisions its stock item when inventory is tracked', async () => {
    productRepository.findById.mockResolvedValue({
      id: 'product-1',
      name: 'Phone',
      sku: 'PHONE',
      isStockTracked: true,
      inventoryItem: null,
    });
    prisma.productVariant.findFirst
      .mockResolvedValueOnce({
        id: 'variant-1',
        productId: 'product-1',
        name: 'Black',
        sku: 'PHONE-BLK',
        isActive: false,
      })
      .mockResolvedValueOnce({
        id: 'variant-1',
        productId: 'product-1',
        name: 'Black',
        sku: 'PHONE-BLK',
        isActive: true,
      });
    prisma.productVariant.update.mockResolvedValue({
      id: 'variant-1',
      isActive: true,
    });

    await service.reactivateVariant('product-1', 'variant-1');

    expect(stockItemsService.getOrCreateFromProduct).toHaveBeenCalledWith({
      productId: 'product-1',
      productName: 'Phone',
      productSku: 'PHONE',
      variantId: 'variant-1',
      variantName: 'Black',
      variantSku: 'PHONE-BLK',
      trackInventory: true,
    });
    expect(prisma.stockItem.updateMany).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        variantId: 'variant-1',
      },
      data: {
        isActive: true,
      },
    });
  });

  it('soft deletes the variant and deactivates its stock item', async () => {
    prisma.productVariant.findFirst.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      isActive: false,
      deletedAt: null,
    });
    prisma.productVariant.update.mockResolvedValue({
      id: 'variant-1',
      isActive: false,
      deletedAt: new Date(),
    });

    await service.deleteVariant('product-1', 'variant-1');

    expect(prisma.stockItem.updateMany).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        variantId: 'variant-1',
      },
      data: {
        isActive: false,
      },
    });
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: {
        isActive: false,
        deletedAt: expect.any(Date),
      },
    });
  });
});
