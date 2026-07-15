import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { StockTrackingMode } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;
type DecimalInput = string | number | Prisma.Decimal;

export type ResolvedInventoryIdentity = {
  productId: string;
  variantId: string | null;
  stockItemId: string | null;
  unitId: string | null;
  quantity: Prisma.Decimal;
  baseQuantity: Prisma.Decimal;
  isStockTracked: boolean;
  isSerialized: boolean;
  trackingMode: StockTrackingMode | null;
};

@Injectable()
export class InventoryIdentityResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForWrite(
    input: {
      productId: string;
      quantity: DecimalInput;
      variantId?: string | null;
      stockItemId?: string | null;
      unitId?: string | null;
    },
    transaction?: Prisma.TransactionClient,
  ): Promise<ResolvedInventoryIdentity> {
    const client = this.client(transaction);
    const product = await client.product.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        isActive: true,
        isStockTracked: true,
        isSerialized: true,
        variants: input.variantId
          ? {
              where: { id: input.variantId },
              select: { id: true },
              take: 1,
            }
          : false,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is inactive');
    }

    if (input.variantId && product.variants.length === 0) {
      throw new NotFoundException('Product variant not found');
    }

    const quantity = this.toPositiveDecimal(input.quantity, 'Quantity');
    const resolvedStockItem = await this.resolveStockItem(
      {
        productId: input.productId,
        variantId: input.variantId ?? null,
        stockItemId: input.stockItemId ?? null,
      },
      transaction,
    );
    const resolvedUnit = await this.resolveUnit(
      {
        stockItemId: resolvedStockItem?.id ?? null,
        unitId: input.unitId ?? null,
      },
      transaction,
    );

    if (input.unitId && !resolvedUnit) {
      throw new BadRequestException(
        'Unit is not valid for the resolved stock item',
      );
    }

    return {
      productId: input.productId,
      variantId: input.variantId ?? null,
      stockItemId: resolvedStockItem?.id ?? null,
      unitId: resolvedUnit?.unitId ?? null,
      quantity,
      baseQuantity: resolvedUnit
        ? quantity.mul(resolvedUnit.conversionToBase)
        : quantity,
      isStockTracked: product.isStockTracked,
      isSerialized: product.isSerialized,
      trackingMode: resolvedStockItem?.trackingMode ?? null,
    };
  }

  private async resolveStockItem(
    input: {
      productId: string;
      variantId: string | null;
      stockItemId: string | null;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const client = this.client(transaction);

    if (input.stockItemId) {
      const stockItem = await client.stockItem.findUnique({
        where: { id: input.stockItemId },
        select: {
          id: true,
          productId: true,
          variantId: true,
          trackingMode: true,
          isActive: true,
          trackInventory: true,
        },
      });

      if (!stockItem) {
        throw new NotFoundException('Stock item not found');
      }

      if (stockItem.productId !== input.productId) {
        throw new BadRequestException(
          'Stock item does not belong to the provided product',
        );
      }

      if (stockItem.variantId !== (input.variantId ?? null)) {
        throw new BadRequestException(
          'Stock item does not belong to the provided variant',
        );
      }

      if (!stockItem.isActive || !stockItem.trackInventory) {
        throw new BadRequestException('Stock item is inactive or not tracked');
      }

      return stockItem;
    }

    if (input.variantId) {
      const variantStockItem = await client.stockItem.findFirst({
        where: {
          productId: input.productId,
          variantId: input.variantId,
          isActive: true,
          trackInventory: true,
        },
        select: {
          id: true,
          productId: true,
          variantId: true,
          trackingMode: true,
          isActive: true,
          trackInventory: true,
        },
      });

      if (variantStockItem) {
        return variantStockItem;
      }
    }

    return client.stockItem.findFirst({
      where: {
        productId: input.productId,
        variantId: null,
        isActive: true,
        trackInventory: true,
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
        trackingMode: true,
        isActive: true,
        trackInventory: true,
      },
    });
  }

  private async resolveUnit(
    input: {
      stockItemId: string | null;
      unitId: string | null;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    if (!input.stockItemId || !input.unitId) {
      return null;
    }

    return this.client(transaction).stockItemUnit.findUnique({
      where: {
        stockItemId_unitId: {
          stockItemId: input.stockItemId,
          unitId: input.unitId,
        },
      },
      select: {
        stockItemId: true,
        unitId: true,
        conversionToBase: true,
      },
    });
  }

  private client(transaction?: Prisma.TransactionClient): PrismaExecutor {
    return transaction ?? this.prisma;
  }

  private toPositiveDecimal(
    value: DecimalInput,
    fieldName: string,
  ): Prisma.Decimal {
    let decimal: Prisma.Decimal;

    try {
      decimal = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`${fieldName} must be a valid number`);
    }

    if (decimal.lte(0)) {
      throw new BadRequestException(`${fieldName} must be greater than zero`);
    }

    return decimal;
  }
}
