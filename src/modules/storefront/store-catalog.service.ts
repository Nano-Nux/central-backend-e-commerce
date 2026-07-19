import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { CatalogLabel } from '../shared/catalog-label';
import { AppConfigService } from '../../infrastructure/config/config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BarcodeRegistryService } from '../inventory/barcode-registry.service';
import { PricingCustomerType, PricingService } from '../pricing/pricing.service';
import {
  StoreCategoryDetailDto,
  StoreCategoryListQueryDto,
  StoreCategoryTreeNodeDto,
  StoreCategoryTreeQueryDto,
  StorePaginationDto,
  StoreProductCardDto,
  StoreProductCardPriceDto,
  StoreProductDetailDto,
  StoreProductListQueryDto,
  StorefrontProductSort,
  StorefrontStockVisibility,
} from './dto/store-catalog.dto';

@Injectable()
export class StoreCatalogService {
  private readonly lowStockThreshold = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly barcodeRegistryService: BarcodeRegistryService,
    private readonly pricingService: PricingService,
    private readonly configService: AppConfigService,
  ) {}

  async listCategories(query: StoreCategoryListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CategoryWhereInput = {
      label: query.label ?? CatalogLabel.CATEGORY,
      parentId: query.parentId,
      OR: query.q
        ? [
            { name: { contains: query.q } },
            { description: { contains: query.q } },
            { slug: { contains: query.q } },
          ]
        : undefined,
    };
    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          parentId: true,
          productAssignments: {
            where: { product: { isActive: true } },
            select: { productId: true },
          },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    const data = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        parentId: category.parentId,
        productCount: category.productAssignments.length,
      }))
      .filter((category) => query.includeEmpty !== false || category.productCount > 0);

    return {
      data,
      pagination: this.pagination(page, limit, total),
    };
  }

  async getCategoryTree(query: StoreCategoryTreeQueryDto) {
    const categories = await this.prisma.category.findMany({
      where: { label: CatalogLabel.CATEGORY },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        parentId: true,
        path: true,
        productAssignments: {
          where: { product: { isActive: true } },
          select: { productId: true },
        },
      },
    });

    const nodeMap = new Map<string, StoreCategoryTreeNodeDto>();
    const roots: StoreCategoryTreeNodeDto[] = [];

    for (const category of categories) {
      const node: StoreCategoryTreeNodeDto = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        parentId: category.parentId,
        productCount: category.productAssignments.length,
        children: [],
      };

      if (query.includeEmpty === false && node.productCount === 0) {
        nodeMap.set(category.id, node);
        continue;
      }

      nodeMap.set(category.id, node);
    }

    for (const category of categories) {
      const node = nodeMap.get(category.id);

      if (!node || (query.includeEmpty === false && node.productCount === 0)) {
        continue;
      }

      if (category.parentId) {
        const parent = nodeMap.get(category.parentId);

        if (parent && (query.includeEmpty !== false || parent.productCount > 0)) {
          parent.children.push(node);
          continue;
        }
      }

      roots.push(node);
    }

    return roots;
  }

  async getCategoryBySlug(slug: string): Promise<StoreCategoryDetailDto> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        parentId: true,
        path: true,
        productAssignments: {
          where: { product: { isActive: true } },
          select: { productId: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const childCategories = await this.prisma.category.findMany({
      where: { parentId: category.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        parentId: true,
        productAssignments: {
          where: { product: { isActive: true } },
          select: { productId: true },
        },
      },
    });

    const breadcrumb = await this.resolveBreadcrumb(category.path);

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      parentId: category.parentId,
      productCount: category.productAssignments.length,
      breadcrumb,
      children: childCategories.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        description: child.description,
        imageUrl: child.imageUrl,
        parentId: child.parentId,
        productCount: child.productAssignments.length,
      })),
    };
  }

  async listProducts(query: StoreProductListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const categoryId = query.categoryId ?? (query.category ? await this.resolveCategoryId(query.category) : undefined);
    const barcodeMatch = query.q
      ? await this.barcodeRegistryService.resolveProductSelection(query.q)
      : null;
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      id: barcodeMatch?.productId,
        categoryAssignments: categoryId ? { some: { categoryId } } : undefined,
      OR:
        query.q && !barcodeMatch
          ? [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
              { sku: { contains: query.q } },
              { barcode: { contains: query.q } },
              { description: { contains: query.q } },
            ]
          : undefined,
    };

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        type: true,
        isFeatured: true,
        createdAt: true,
        categoryAssignments: {
          select: {
            category: { select: { id: true, name: true, label: true, slug: true, description: true } },
          },
        },
        images: {
          select: {
            url: true,
            position: true,
          },
          orderBy: { position: 'asc' },
          take: 1,
        },
        inventoryItem: {
          select: {
            quantityOnHand: true,
            reservedQuantity: true,
          },
        },
        stockItems: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            variantId: true,
            name: true,
            sku: true,
            inventoryItem: {
              select: {
                quantityOnHand: true,
                reservedQuantity: true,
              },
            },
            units: {
              where: {
                isSalesUnit: true,
              },
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                unitId: true,
                conversionToBase: true,
                isBaseUnit: true,
                isSalesUnit: true,
                allowsFractional: true,
                unit: {
                  select: {
                    name: true,
                    symbol: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const pricedProducts = await Promise.all(
      products.map(async (product) => {
        const price = await this.resolveStorePrice(product.id);
        const stockVisibility = this.getStockVisibility(
          this.availableInventory(product.inventoryItem),
        );

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription,
          primaryImageUrl: product.images[0]?.url ?? null,
          category: this.primaryCategory(product.categoryAssignments),
          brand: this.primaryBrand(product.categoryAssignments),
          productType: product.type,
          price,
          stockVisibility,
          isFeatured: product.isFeatured,
          createdAt: product.createdAt,
        } satisfies StoreProductCardDto;
      }),
    );

    const filtered = query.inStock
      ? pricedProducts.filter(
          (product) =>
            product.stockVisibility === StorefrontStockVisibility.IN_STOCK ||
            product.stockVisibility === StorefrontStockVisibility.LOW_STOCK,
        )
      : pricedProducts;
    const filteredByCatalog = filtered.filter((product) =>
      (!query.brandId || product.brand?.id === query.brandId) &&
      (query.minPrice === undefined || Number(product.price.amount) >= query.minPrice) &&
      (query.maxPrice === undefined || Number(product.price.amount) <= query.maxPrice),
    );
    const sorted = this.sortProducts(filteredByCatalog, query.sort ?? StorefrontProductSort.NEWEST);
    const start = (page - 1) * limit;

    return {
      data: sorted.slice(start, start + limit),
      pagination: this.pagination(page, limit, sorted.length),
    };
  }

  async getProductBySlug(slug: string): Promise<StoreProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        type: true,
        isActive: true,
        isFeatured: true,
        createdAt: true,
        categoryAssignments: {
          select: {
            category: { select: { id: true, name: true, label: true, slug: true, description: true } },
          },
        },
        images: {
          select: {
            id: true,
            url: true,
            position: true,
          },
          orderBy: { position: 'asc' },
        },
        attributes: {
          select: {
            key: true,
            value: true,
          },
        },
        inventoryItem: {
          select: {
            quantityOnHand: true,
            reservedQuantity: true,
          },
        },
        stockItems: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            variantId: true,
            name: true,
            sku: true,
            inventoryItem: {
              select: {
                quantityOnHand: true,
                reservedQuantity: true,
              },
            },
            units: {
              where: {
                isSalesUnit: true,
              },
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                unitId: true,
                conversionToBase: true,
                isBaseUnit: true,
                isSalesUnit: true,
                allowsFractional: true,
                unit: {
                  select: {
                    name: true,
                    symbol: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    const price = await this.resolveStorePrice(product.id);
    const productVariants = await this.prisma.productVariant.findMany({
      where: {
        productId: product.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        attributes: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const variants = await Promise.all(
      productVariants.map(async (variant) => {
        const stockItem = product.stockItems.find(
          (entry) => entry.variantId === variant.id,
        );
        const variantAvailable = stockItem?.inventoryItem
          ? stockItem.inventoryItem.quantityOnHand.minus(
              stockItem.inventoryItem.reservedQuantity,
            )
          : null;

        return {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          barcode: variant.barcode,
          attributes: this.toRecord(variant.attributes),
          price: await this.resolveStorePrice(product.id, variant.id),
          stockVisibility: this.getStockVisibility(variantAvailable),
          stockItemId: stockItem?.id ?? null,
        };
      }),
    );

    const stockItems = product.stockItems.map((stockItem) => {
      const quantityOnHand =
        stockItem.inventoryItem?.quantityOnHand ?? new Prisma.Decimal(0);
      const reservedQuantity =
        stockItem.inventoryItem?.reservedQuantity ?? new Prisma.Decimal(0);
      const availableQuantity = quantityOnHand.minus(reservedQuantity);

      return {
        id: stockItem.id,
        variantId: stockItem.variantId ?? null,
        name: stockItem.name,
        sku: stockItem.sku,
        stockVisibility: this.getStockVisibility(availableQuantity),
        quantityOnHand: quantityOnHand.toString(),
        reservedQuantity: reservedQuantity.toString(),
        availableQuantity: availableQuantity.toString(),
        units: stockItem.units.map((unit) => ({
          id: unit.id,
          unitId: unit.unitId,
          name: unit.unit.name,
          symbol: unit.unit.symbol,
          conversionToBase: unit.conversionToBase.toString(),
          isBaseUnit: unit.isBaseUnit,
          isSalesUnit: unit.isSalesUnit,
          allowsFractional: unit.allowsFractional,
        })),
      };
    });

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      primaryImageUrl: product.images[0]?.url ?? null,
      category: this.primaryCategory(product.categoryAssignments),
      brand: this.primaryBrand(product.categoryAssignments),
      productType: product.type,
      price,
      stockVisibility: this.getStockVisibility(
        this.availableInventory(product.inventoryItem),
      ),
      isFeatured: product.isFeatured,
      createdAt: product.createdAt,
      description: product.description,
      images: product.images,
      attributes: product.attributes,
      variants,
      stockItems,
    };
  }

  async getFeaturedProducts(limit = 12) {
    return this.getProductCollection({ isFeatured: true }, limit);
  }

  async getProductAvailability(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        inventoryItem: {
          select: {
            quantityOnHand: true,
            reservedQuantity: true,
          },
        },
        stockItems: {
          where: { isActive: true },
          select: {
            id: true,
            variantId: true,
            name: true,
            sku: true,
            inventoryItem: {
              select: {
                quantityOnHand: true,
                reservedQuantity: true,
              },
            },
            units: {
              where: { isSalesUnit: true },
              include: { unit: true },
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      stockVisibility: this.getStockVisibility(
        this.availableInventory(product.inventoryItem),
      ),
      stockItems: product.stockItems.map((stockItem) => {
        const available = this.availableInventory(stockItem.inventoryItem);

        return {
          id: stockItem.id,
          variantId: stockItem.variantId,
          name: stockItem.name,
          sku: stockItem.sku,
          quantityOnHand:
            stockItem.inventoryItem?.quantityOnHand.toString() ?? '0',
          reservedQuantity:
            stockItem.inventoryItem?.reservedQuantity.toString() ?? '0',
          availableQuantity: available?.toString() ?? '0',
          stockVisibility: this.getStockVisibility(available),
          units: stockItem.units.map((unit) => ({
            id: unit.id,
            unitId: unit.unitId,
            name: unit.unit.name,
            symbol: unit.unit.symbol,
            conversionToBase: unit.conversionToBase.toString(),
          })),
        };
      }),
    };
  }

  async getProductVariants(slug: string) {
    const detail = await this.getProductBySlug(slug);
    return detail.variants;
  }

  async getProductUnits(slug: string) {
    const availability = await this.getProductAvailability(slug);

    return availability.stockItems.map((stockItem) => ({
      stockItemId: stockItem.id,
      variantId: stockItem.variantId,
      name: stockItem.name,
      units: stockItem.units,
    }));
  }

  async getNewArrivals(limit = 12) {
    return this.getProductCollection({}, limit);
  }

  async getRelatedProducts(slug: string, limit = 8) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        categoryAssignments: { select: { categoryId: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.getProductCollection(
      {
        categoryAssignments: product.categoryAssignments.length
          ? { some: { categoryId: { in: product.categoryAssignments.map((assignment) => assignment.categoryId) } } }
          : undefined,
        id: { not: product.id },
      },
      limit,
    );
  }

  private async getProductCollection(
    where: Prisma.ProductWhereInput,
    limit: number,
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...where,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        type: true,
        isFeatured: true,
        createdAt: true,
        categoryAssignments: {
          select: {
            category: { select: { id: true, name: true, label: true, slug: true } },
          },
        },
        images: {
          select: { url: true },
          orderBy: { position: 'asc' },
          take: 1,
        },
        inventoryItem: {
          select: {
            quantityOnHand: true,
            reservedQuantity: true,
          },
        },
      },
    });

    return Promise.all(
      products.map(async (product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        primaryImageUrl: product.images[0]?.url ?? null,
        category: this.primaryCategory(product.categoryAssignments),
        productType: product.type,
        price: await this.resolveStorePrice(product.id),
        stockVisibility: this.getStockVisibility(
          this.availableInventory(product.inventoryItem),
        ),
        isFeatured: product.isFeatured,
        createdAt: product.createdAt,
      })),
    );
  }

  private primaryCategory(assignments: Array<{ category: { id: string; name: string; label: string; slug: string; description?: string | null } }>) {
    return assignments.find((assignment) => assignment.category.label === CatalogLabel.CATEGORY)?.category
      ?? assignments[0]?.category
      ?? null;
  }

  private primaryBrand(assignments: Array<{ category: { id: string; name: string; label: string; slug: string; description?: string | null } }>) {
    return assignments.find((assignment) => assignment.category.label === CatalogLabel.BRAND)?.category ?? null;
  }

  private async resolveStorePrice(
    productId: string,
    variantId?: string,
  ): Promise<StoreProductCardPriceDto> {
    const resolved = await this.pricingService.resolvePrice({
      productId,
      variantId,
      customerType: PricingCustomerType.RETAIL,
      currentDate: new Date(),
    });

    return {
      amount: resolved.finalPrice.toString(),
      currency: this.configService.getCurrency(),
      rule: resolved.appliedRule,
      baseAmount: resolved.basePrice.toString(),
    };
  }

  private getStockVisibility(available?: Prisma.Decimal | null) {
    if (!available) {
      return StorefrontStockVisibility.IN_STOCK;
    }

    if (available.lte(0)) {
      return StorefrontStockVisibility.OUT_OF_STOCK;
    }

    if (available.lte(this.lowStockThreshold)) {
      return StorefrontStockVisibility.LOW_STOCK;
    }

    return StorefrontStockVisibility.IN_STOCK;
  }

  private availableInventory(
    inventoryItems:
      | Array<{
          quantityOnHand: Prisma.Decimal;
          reservedQuantity: Prisma.Decimal;
        }>
      | {
          quantityOnHand: Prisma.Decimal;
          reservedQuantity: Prisma.Decimal;
        }
      | null
      | undefined,
  ) {
    if (!inventoryItems) {
      return null;
    }

    if (!Array.isArray(inventoryItems)) {
      return inventoryItems.quantityOnHand.minus(inventoryItems.reservedQuantity);
    }

    return inventoryItems.reduce(
      (total, item) => total.plus(item.quantityOnHand.minus(item.reservedQuantity)),
      new Prisma.Decimal(0),
    );
  }

  private sortProducts(
    products: StoreProductCardDto[],
    sort: StorefrontProductSort,
  ) {
    return [...products].sort((left, right) => {
      switch (sort) {
        case StorefrontProductSort.NAME_ASC:
          return left.name.localeCompare(right.name);
        case StorefrontProductSort.NAME_DESC:
          return right.name.localeCompare(left.name);
        case StorefrontProductSort.PRICE_ASC:
          return Number(left.price.amount) - Number(right.price.amount);
        case StorefrontProductSort.PRICE_DESC:
          return Number(right.price.amount) - Number(left.price.amount);
        case StorefrontProductSort.NEWEST:
        default:
          return right.createdAt.getTime() - left.createdAt.getTime();
      }
    });
  }

  private async resolveCategoryId(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    return category?.id;
  }

  private async resolveBreadcrumb(path: string) {
    const ids = path
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!ids.length) {
      return [];
    }

    const categories = await this.prisma.category.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    return ids
      .map((id) => categoryMap.get(id))
      .filter((category): category is NonNullable<typeof category> => Boolean(category));
  }

  private toRecord(value: Prisma.JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  private pagination(page: number, limit: number, total: number): StorePaginationDto {
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }
}
