import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import {
  normalizeOptionalToken,
  sanitizeOptionalPlainText,
  sanitizePlainText,
} from '../../common/utils/input-sanitizer.util';
import { buildStableSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CategoryRepository } from '../category/category.repository';
import { StockItemsService } from '../inventory/stock-items.service';
import { AssignProductCategoryDto } from '../shared/dto/assign-product-category.dto';
import { CreateProductDto } from '../shared/dto/create-product.dto';
import { ProductListQueryDto } from '../shared/dto/product-list-query.dto';
import { UpdateProductDto } from '../shared/dto/update-product.dto';
import {
  createPaginationMeta,
  normalizePagination,
} from '../shared/helpers/pagination.helper';
import { ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly prisma: PrismaService,
    private readonly stockItemsService: StockItemsService,
    private readonly auditService: AuditService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const categoryIds = this.normalizeCategoryIds(
      createProductDto.categoryIds,
      createProductDto.brandIds,
    );
    await this.ensureCategoriesExist(categoryIds);
    const id = randomUUID();
    const name = sanitizePlainText(createProductDto.name);
    const description = sanitizeOptionalPlainText(createProductDto.description);

    const data: Prisma.ProductCreateInput = {
      id,
      name,
      slug: buildStableSlug(name, id.slice(0, 8)),
      description,
      shortDescription: description?.slice(0, 500),
      sku: normalizeOptionalToken(createProductDto.sku),
      barcode: normalizeOptionalToken(createProductDto.barcode),
      type: createProductDto.type,
      isActive: createProductDto.isActive ?? true,
      isStockTracked: createProductDto.isStockTracked ?? true,
      isSerialized: createProductDto.isSerialized ?? false,
      categoryAssignments: categoryIds.length
        ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
        : undefined,
      variants: createProductDto.variants?.length
        ? {
            create: createProductDto.variants.map((variant) => ({
              name: sanitizePlainText(variant.name),
              sku: sanitizePlainText(variant.sku),
              barcode: normalizeOptionalToken(variant.barcode),
              attributes: variant.attributes as Prisma.InputJsonObject,
            })),
          }
        : undefined,
      images: createProductDto.images?.length
        ? {
            create: createProductDto.images.map((image) => ({
              url: image.url,
              position: image.position ?? 0,
            })),
          }
        : undefined,
      attributes: createProductDto.attributes?.length
        ? {
            create: createProductDto.attributes.map((attribute) => ({
              key: sanitizePlainText(attribute.key),
              value: sanitizePlainText(attribute.value),
            })),
          }
        : undefined,
      prices: createProductDto.pricing
        ? {
            create: {
              costPrice: createProductDto.pricing.costPrice,
              sellingPrice: createProductDto.pricing.sellingPrice,
              wholesalePrice: createProductDto.pricing.wholesalePrice,
              memberPrice: createProductDto.pricing.memberPrice,
              promotionPrice: createProductDto.pricing.promotionPrice,
              promotionStartAt: createProductDto.pricing.promotionStartAt
                ? new Date(createProductDto.pricing.promotionStartAt)
                : undefined,
              promotionEndAt: createProductDto.pricing.promotionEndAt
                ? new Date(createProductDto.pricing.promotionEndAt)
                : undefined,
            },
          }
        : undefined,
    };

    try {
      const product = this.normalizeProductDetail(
        await this.productRepository.create(data),
      );

      if (product.isStockTracked) {
        await this.stockItemsService.getOrCreateFromProduct({
          productId: product.id,
          productName: product.name,
          productSku: product.sku ?? `PRODUCT-${product.id.slice(0, 8)}`,
          trackInventory: product.isStockTracked,
        });

        for (const variant of product.variants ?? []) {
          await this.stockItemsService.getOrCreateFromProduct({
            productId: product.id,
            productName: product.name,
            productSku: product.sku ?? `PRODUCT-${product.id.slice(0, 8)}`,
            variantId: variant.id,
            variantName: variant.name,
            variantSku: variant.sku,
            trackInventory: product.isStockTracked,
          });
        }
      }

      return product;
    } catch (error) {
      this.handleKnownWriteError(error);
    }
  }

  async findAll(query: ProductListQueryDto) {
    const { page, limit, skip, take } = normalizePagination(
      query.page,
      query.limit,
    );
    const where = this.buildProductWhere(query);
    const [products, total] = await Promise.all([
      this.productRepository.findMany({ where, skip, take }),
      this.productRepository.count(where),
    ]);

    return {
      data: products.map((product) => this.normalizeProductDetail(product)),
      pagination: createPaginationMeta(page, limit, total),
    };
  }

  async findOne(id: string) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.normalizeProductDetail(product);
  }

  async findInventory(id: string) {
    await this.findOne(id);
    return this.prisma.inventoryItem.findMany({
      where: { productId: id },
      include: { stockItem: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const existing = await this.findOne(id);
    const categoriesWereProvided =
      Object.prototype.hasOwnProperty.call(updateProductDto, 'categoryIds') ||
      Object.prototype.hasOwnProperty.call(updateProductDto, 'brandIds');
    const categoryIds = this.normalizeCategoryIds(
      updateProductDto.categoryIds,
    );
    const brandIds = this.normalizeCategoryIds(updateProductDto.brandIds);
    const existingCategoryIds = (existing.categories ?? [])
      .filter((category: any) => category.label !== 'brand')
      .map((category: any) => category.id);
    const existingBrandIds = (existing.categories ?? [])
      .filter((category: any) => category.label === 'brand')
      .map((category: any) => category.id);
    const assignmentIds = this.normalizeCategoryIds(
      categoriesWereProvided && Object.prototype.hasOwnProperty.call(updateProductDto, 'categoryIds')
        ? categoryIds
        : existingCategoryIds,
      categoriesWereProvided && Object.prototype.hasOwnProperty.call(updateProductDto, 'brandIds')
        ? brandIds
        : existingBrandIds,
    );
    if (categoriesWereProvided) {
      await this.ensureCategoriesExist(assignmentIds);
    }
    const name = updateProductDto.name
      ? sanitizePlainText(updateProductDto.name)
      : undefined;
    const description =
      updateProductDto.description === undefined
        ? undefined
        : (sanitizeOptionalPlainText(updateProductDto.description) ?? null);
    const data: Prisma.ProductUpdateInput = {
      name,
      slug: name ? buildStableSlug(name, existing.id.slice(0, 8)) : undefined,
      description,
      shortDescription:
        description === undefined
          ? undefined
          : (description?.slice(0, 500) ?? null),
      sku:
        updateProductDto.sku === undefined
          ? undefined
          : normalizeOptionalToken(updateProductDto.sku) ?? null,
      barcode:
        updateProductDto.barcode === undefined
          ? undefined
          : (normalizeOptionalToken(updateProductDto.barcode) ?? null),
      type: updateProductDto.type,
      isActive: updateProductDto.isActive,
      isStockTracked: updateProductDto.isStockTracked,
      isSerialized: updateProductDto.isSerialized,
      categoryAssignments: categoriesWereProvided
        ? {
            deleteMany: {},
            create: assignmentIds.map((categoryId) => ({ categoryId })),
          }
        : undefined,
    };

    try {
      return this.normalizeProductDetail(
        await this.productRepository.update(id, data),
      );
    } catch (error) {
      this.handleKnownWriteError(error);
    }
  }

  async assignCategory(id: string, dto: AssignProductCategoryDto) {
    return this.update(id, { categoryIds: dto.categoryId ? [dto.categoryId] : [] });
  }

  async deactivate(id: string) {
    await this.findOne(id);

    return this.productRepository.update(id, {
      isActive: false,
    });
  }

  async createVariant(
    productId: string,
    input: {
      name: string;
      sku: string;
      barcode?: string;
      attributes: Record<string, unknown>;
    },
  ) {
    const product = await this.findOne(productId);

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        name: sanitizePlainText(input.name),
        sku: sanitizePlainText(input.sku),
        barcode: normalizeOptionalToken(input.barcode),
        attributes: input.attributes as Prisma.InputJsonObject,
      },
    });

    if (product.isStockTracked) {
      await this.stockItemsService.getOrCreateFromProduct({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        variantId: variant.id,
        variantName: variant.name,
        variantSku: variant.sku,
        trackInventory: product.isStockTracked,
      });
    }

    this.auditService.logCreate(
      'PRODUCT_VARIANT',
      variant.id,
      variant,
      { productId },
    );

    return variant;
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: {
      name?: string;
      sku?: string;
      barcode?: string | null;
      attributes?: Record<string, unknown>;
    },
  ) {
    await this.findOne(productId);
    await this.ensureVariantExists(productId, variantId);

    const before = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name: input.name ? sanitizePlainText(input.name) : undefined,
        sku: input.sku ? sanitizePlainText(input.sku) : undefined,
        barcode:
          input.barcode === undefined
            ? undefined
            : (normalizeOptionalToken(input.barcode) ?? null),
        attributes: input.attributes as Prisma.InputJsonObject | undefined,
      },
    });

    this.auditService.logUpdate(
      'PRODUCT_VARIANT',
      variantId,
      before,
      updated,
      { productId },
    );

    return updated;
  }

  async deactivateVariant(productId: string, variantId: string) {
    await this.ensureVariantExists(productId, variantId);

    await this.prisma.stockItem.updateMany({
      where: {
        productId,
        variantId,
      },
      data: {
        isActive: false,
      },
    });

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        isActive: false,
      },
    });

    this.auditService.logAction(
      'DEACTIVATE',
      'PRODUCT_VARIANT',
      variantId,
      { isActive: true },
      { isActive: false },
      { productId },
    );

    return updated;
  }

  async reactivateVariant(productId: string, variantId: string) {
    const product = await this.findOne(productId);
    const variant = await this.ensureVariantExists(productId, variantId, false);

    if (variant.deletedAt) {
      throw new ConflictException('Deleted product variants cannot be reactivated');
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        isActive: true,
      },
    });

    if (product.isStockTracked) {
      await this.stockItemsService.getOrCreateFromProduct({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        variantId: variant.id,
        variantName: variant.name,
        variantSku: variant.sku,
        trackInventory: product.isStockTracked,
      });

      await this.prisma.stockItem.updateMany({
        where: {
          productId,
          variantId,
        },
        data: {
          isActive: true,
        },
      });
    }

    const updated = await this.ensureVariantExists(productId, variantId);
    this.auditService.logAction(
      'REACTIVATE',
      'PRODUCT_VARIANT',
      variantId,
      { isActive: false },
      { isActive: true },
      { productId },
    );

    return updated;
  }

  async deleteVariant(productId: string, variantId: string) {
    await this.ensureVariantExists(productId, variantId, false);

    await this.prisma.stockItem.updateMany({
      where: {
        productId,
        variantId,
      },
      data: {
        isActive: false,
      },
    });

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    this.auditService.logDelete(
      'PRODUCT_VARIANT',
      variantId,
      { productId, isActive: false },
      { deletedAt: updated.deletedAt },
    );

    return updated;
  }

  private buildProductWhere(
    query: ProductListQueryDto,
  ): Prisma.ProductWhereInput {
    return {
      categoryAssignments: query.categoryId
        ? { some: { categoryId: query.categoryId } }
        : undefined,
      type: query.type,
      OR: query.q
        ? [
            { name: { contains: query.q } },
            { sku: { contains: query.q } },
            { barcode: { contains: query.q } },
          ]
        : undefined,
    };
  }

  private async ensureCategoryExists(categoryId?: string | null) {
    if (!categoryId) {
      return;
    }

    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async ensureCategoriesExist(categoryIds: string[]) {
    await Promise.all(categoryIds.map((categoryId) => this.ensureCategoryExists(categoryId)));
  }

  private normalizeCategoryIds(categoryIds?: string[], brandIds?: string[]) {
    return [...new Set([...(categoryIds ?? []), ...(brandIds ?? [])])];
  }

  private handleKnownWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Product SKU already exists');
    }

    throw error;
  }

  private async ensureVariantExists(
    productId: string,
    variantId: string,
    activeOnly = true,
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        deletedAt: null,
        ...(activeOnly ? { isActive: true } : {}),
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    return variant;
  }

  private normalizeProductDetail(product: any) {
    const categories = Array.isArray(product?.categoryAssignments)
      ? product.categoryAssignments.map((assignment: any) => assignment.category)
      : (product?.categories ?? []);

    product = { ...product, categories };

    if (!Array.isArray(product?.inventoryItem)) {
    return product;
  }

    const quantityOnHand = product.inventoryItem.reduce(
      (total, item) => total.plus(item.quantityOnHand),
      new Prisma.Decimal(0),
    );
    const reservedQuantity = product.inventoryItem.reduce(
      (total, item) => total.plus(item.reservedQuantity),
      new Prisma.Decimal(0),
    );

    return {
      ...product,
      inventoryItem: {
        quantityOnHand,
        reservedQuantity,
      },
    };
  }
}
