import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { AppConfigService } from '../../infrastructure/config/config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BarcodeRegistryService } from '../inventory/barcode-registry.service';
import { InventoryIdentityResolverService } from '../inventory/inventory-identity-resolver.service';
import { PricingCustomerType, PricingService } from '../pricing/pricing.service';
import { StoreAccountService } from './store-account.service';
import {
  MergeStoreCartDto,
  StoreCartDto,
  StoreCartItemMutationDto,
  UpdateStoreCartItemDto,
} from './dto/store-cart.dto';
import { StorefrontStockVisibility } from './dto/store-catalog.dto';

@Injectable()
export class StoreCartService {
  private readonly lowStockThreshold = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly storeAccountService: StoreAccountService,
    private readonly configService: AppConfigService,
    private readonly barcodeRegistryService: BarcodeRegistryService,
    private readonly inventoryIdentityResolver: InventoryIdentityResolverService,
  ) {}

  async getCart(userId: string) {
    const customer = await this.storeAccountService.ensureCustomerForUser(userId);
    const cart = await this.ensureCart(customer.id);

    return this.mapCart(cart);
  }

  async addItem(userId: string, dto: StoreCartItemMutationDto) {
    const customer = await this.storeAccountService.ensureCustomerForUser(userId);
    const cart = await this.ensureCart(customer.id);
    const selection = await this.resolveCartSelection(dto);
    const lineKey = this.lineKey(
      selection.productId,
      selection.variantId ?? undefined,
      selection.stockItemId,
      selection.unitId,
    );

    await this.prisma.cartItem.upsert({
      where: {
        cartId_lineKey: {
          cartId: cart.id,
          lineKey,
        },
      },
      update: {
        quantity: {
          increment: new Prisma.Decimal(dto.quantity),
        },
        baseQuantity: {
          increment: selection.baseQuantity,
        },
      },
      create: {
        cartId: cart.id,
        productId: selection.productId,
        stockItemId: selection.stockItemId,
        variantId: selection.variantId,
        unitId: selection.unitId,
        lineKey,
        quantity: new Prisma.Decimal(dto.quantity),
        baseQuantity: selection.baseQuantity,
      },
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateStoreCartItemDto) {
    const customer = await this.storeAccountService.ensureCustomerForUser(userId);
    const cart = await this.ensureCart(customer.id);
    const item = await this.ensureItemOwnership(cart.id, itemId);
    const resolvedIdentity = await this.inventoryIdentityResolver.resolveForWrite({
      productId: item.productId,
      variantId: item.variantId,
      stockItemId: item.stockItemId,
      unitId: item.unitId,
      quantity: dto.quantity,
    });

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: new Prisma.Decimal(dto.quantity),
        baseQuantity: resolvedIdentity.baseQuantity,
      },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const customer = await this.storeAccountService.ensureCustomerForUser(userId);
    const cart = await this.ensureCart(customer.id);
    await this.ensureItemOwnership(cart.id, itemId);
    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const customer = await this.storeAccountService.ensureCustomerForUser(userId);
    const cart = await this.ensureCart(customer.id);
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getCart(userId);
  }

  async mergeCart(userId: string, dto: MergeStoreCartDto) {
    for (const item of dto.items) {
      await this.addItem(userId, item);
    }

    return this.getCart(userId);
  }

  private async ensureCart(customerId: string) {
    const existing = await this.prisma.cart.findUnique({
      where: { customerId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { position: 'asc' },
                  take: 1,
                },
                inventoryItem: true,
              },
            },
            stockItem: {
              include: {
                inventoryItem: true,
              },
            },
            variant: true,
            unit: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.cart.create({
      data: {
        customerId,
        currency: this.configService.getCurrency(),
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { position: 'asc' },
                  take: 1,
                },
                inventoryItem: true,
              },
            },
            stockItem: {
              include: {
                inventoryItem: true,
              },
            },
            variant: true,
            unit: true,
          },
        },
      },
    });
  }

  private async mapCart(cart: Awaited<ReturnType<StoreCartService['ensureCart']>>): Promise<StoreCartDto> {
    const items = await Promise.all(
      cart.items.map(async (item) => {
        const resolvedPrice = await this.pricingService.resolvePrice({
          productId: item.productId,
          variantId: item.variantId,
          customerType: PricingCustomerType.MEMBER,
          currentDate: new Date(),
        });
        const quantity = new Prisma.Decimal(item.quantity);
        const available = item.stockItem
          ? this.availableInventory(item.stockItem.inventoryItem)
          : this.availableInventory(item.product.inventoryItem);
        const stockVisibility = !item.product.isStockTracked || !available
          ? StorefrontStockVisibility.IN_STOCK
          : available.lte(0)
            ? StorefrontStockVisibility.OUT_OF_STOCK
            : available.lte(this.lowStockThreshold)
              ? StorefrontStockVisibility.LOW_STOCK
              : StorefrontStockVisibility.IN_STOCK;

        return {
          id: item.id,
          lineKey: item.lineKey,
          productId: item.productId,
          variantId: item.variantId,
          stockItemId: item.stockItemId,
          unitId: item.unitId,
          productName: item.product.name,
          variantName: item.variant?.name ?? null,
          unitName: item.unit?.name ?? null,
          quantity: quantity.toString(),
          baseQuantity:
            item.baseQuantity?.toString() ?? quantity.toString(),
          unitPrice: {
            amount: resolvedPrice.finalPrice.toString(),
            currency: cart.currency,
            rule: resolvedPrice.appliedRule,
            baseAmount: resolvedPrice.basePrice.toString(),
          },
          lineTotal: resolvedPrice.finalPrice.mul(quantity).toString(),
          stockVisibility,
        };
      }),
    );

    const subtotal = items.reduce(
      (total, item) => total.plus(item.lineTotal),
      new Prisma.Decimal(0),
    );

    return {
      id: cart.id,
      currency: cart.currency,
      subtotal: subtotal.toString(),
      items,
    };
  }

  private async findProduct(productId: string, variantId?: string | null) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: variantId,
          productId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!variant) {
        throw new BadRequestException('Product variant not found');
      }
    }

    return product;
  }

  private async ensureItemOwnership(cartId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
      },
      select: {
        id: true,
        productId: true,
        stockItemId: true,
        variantId: true,
        unitId: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    return item;
  }

  private async resolveCartSelection(input: StoreCartItemMutationDto) {
    let productId = input.productId;
    let variantId = input.variantId ?? null;
    let stockItemId = input.stockItemId ?? null;
    let unitId = input.unitId ?? null;

    if (!productId) {
      if (!input.barcode) {
        throw new BadRequestException('Cart item product or barcode is required');
      }

      const resolved =
        await this.barcodeRegistryService.resolveProductSelection(input.barcode);

      if (!resolved) {
        throw new NotFoundException('Barcode not found');
      }

      productId = resolved.productId;
      variantId = resolved.variantId;
      stockItemId = stockItemId ?? resolved.stockItemId;
      unitId = unitId ?? resolved.unitId;
    }

    await this.findProduct(productId, variantId);

    const resolvedIdentity = await this.inventoryIdentityResolver.resolveForWrite({
      productId,
      variantId,
      stockItemId,
      unitId,
      quantity: input.quantity,
    });

    return {
      productId,
      variantId: variantId ?? null,
      stockItemId: resolvedIdentity.stockItemId,
      unitId: resolvedIdentity.unitId,
      baseQuantity: resolvedIdentity.baseQuantity,
    };
  }

  private lineKey(
    productId: string,
    variantId?: string,
    stockItemId?: string | null,
    unitId?: string | null,
  ) {
    return [
      productId,
      variantId ?? 'base',
      stockItemId ?? 'legacy-product',
      unitId ?? 'base-unit',
    ].join(':');
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
}
