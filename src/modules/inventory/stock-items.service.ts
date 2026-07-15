import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { StockTrackingMode } from '../../../generated/prisma/enums';
import { StockItemsRepository } from './stock-items.repository';

@Injectable()
export class StockItemsService {
  constructor(private readonly stockItemsRepository: StockItemsRepository) {}

  async getById(id: string) {
    const stockItem = await this.stockItemsRepository.findById(id);

    if (!stockItem) {
      throw new NotFoundException('Stock item not found');
    }

    return stockItem;
  }

  async getOrCreateFromProduct(input: {
    productId: string;
    productName: string;
    productSku: string;
    variantId?: string | null;
    variantName?: string | null;
    variantSku?: string | null;
    trackInventory?: boolean;
    trackingMode?: StockTrackingMode;
  }) {
    const existing = await this.stockItemsRepository.findByProductAndVariant(
      input.productId,
      input.variantId,
    );

    if (existing) {
      return existing;
    }

    const variantSuffix = input.variantName?.trim()
      ? ` - ${input.variantName.trim()}`
      : '';
    const sku = input.variantSku?.trim() || input.productSku.trim();

    return this.stockItemsRepository.create({
      id: randomUUID(),
      productId: input.productId,
      variantId: input.variantId ?? null,
      name: `${input.productName.trim()}${variantSuffix}`,
      sku,
      trackInventory: input.trackInventory ?? true,
      trackingMode: input.trackingMode ?? StockTrackingMode.SIMPLE,
    });
  }

  async setBaseUnit(stockItemId: string, baseUnitId: string) {
    await this.getById(stockItemId);

    return this.stockItemsRepository.update(stockItemId, {
      baseUnitId,
    });
  }

  async list(params?: { productId?: string; variantId?: string; isActive?: boolean }) {
    return this.stockItemsRepository.list(params);
  }

  async deactivate(stockItemId: string) {
    await this.getById(stockItemId);

    return this.stockItemsRepository.update(stockItemId, {
      isActive: false,
    });
  }

  ensureTracked(stockItem: { isActive: boolean; trackInventory: boolean }) {
    if (!stockItem.isActive) {
      throw new BadRequestException('Stock item is inactive');
    }

    if (!stockItem.trackInventory) {
      throw new BadRequestException('Stock item does not track inventory');
    }
  }
}
