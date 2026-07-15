import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { StockItemsService } from './stock-items.service';
import { UnitsRepository } from './units.repository';

@Injectable()
export class UnitsService {
  constructor(
    private readonly unitsRepository: UnitsRepository,
    private readonly stockItemsService: StockItemsService,
    private readonly auditService: AuditService,
  ) {}

  async createMeasurementGroup(input: { code: string; name: string }) {
    const code = this.normalizeCode(input.code);
    const existing = await this.unitsRepository.findMeasurementGroupByCode(code);

    if (existing) {
      return existing;
    }

    const created = await this.unitsRepository.createMeasurementGroup({
      id: randomUUID(),
      code,
      name: input.name.trim(),
    });

    this.auditService.logCreate('MEASUREMENT_GROUP', created.id, created);

    return created;
  }

  async createUnit(input: {
    code: string;
    name: string;
    symbol?: string;
    measurementGroupId?: string;
    allowsDecimal?: boolean;
  }) {
    const code = this.normalizeCode(input.code);
    const existing = await this.unitsRepository.findUnitByCode(code);

    if (existing) {
      return existing;
    }

    const created = await this.unitsRepository.createUnit({
      id: randomUUID(),
      code,
      name: input.name.trim(),
      symbol: input.symbol?.trim() || null,
      measurementGroupId: input.measurementGroupId ?? null,
      allowsDecimal: input.allowsDecimal ?? true,
    });

    this.auditService.logCreate('UNIT', created.id, created);

    return created;
  }

  async assignUnit(input: {
    stockItemId: string;
    unitId: string;
    conversionToBase: string | number | Prisma.Decimal;
    isBaseUnit?: boolean;
    isSalesUnit?: boolean;
    isPurchaseUnit?: boolean;
    allowsFractional?: boolean;
    position?: number;
  }) {
    const stockItem = await this.stockItemsService.getById(input.stockItemId);
    this.stockItemsService.ensureTracked(stockItem);

    const unit = await this.unitsRepository.findUnitById(input.unitId);

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const conversionToBase = this.toPositiveDecimal(
      input.conversionToBase,
      'Conversion factor',
    );

    const assigned = await this.unitsRepository.assignUnitToStockItem({
      id: randomUUID(),
      stockItemId: input.stockItemId,
      unitId: input.unitId,
      conversionToBase,
      isBaseUnit: input.isBaseUnit ?? false,
      isSalesUnit: input.isSalesUnit ?? false,
      isPurchaseUnit: input.isPurchaseUnit ?? false,
      allowsFractional: input.allowsFractional ?? true,
      position: input.position ?? 0,
    });

    this.auditService.logCreate(
      'STOCK_ITEM_UNIT',
      assigned.id,
      assigned,
      { stockItemId: input.stockItemId, unitId: input.unitId },
    );

    return assigned;
  }

  async addConversion(input: {
    stockItemId: string;
    fromUnitId: string;
    toUnitId: string;
    factor: string | number | Prisma.Decimal;
  }) {
    const factor = this.toPositiveDecimal(input.factor, 'Conversion factor');
    await this.stockItemsService.getById(input.stockItemId);

    if (input.fromUnitId === input.toUnitId) {
      throw new BadRequestException('Conversion units must be different');
    }

    const assignedUnits = await this.unitsRepository.findAssignedUnitIds(
      input.stockItemId,
      [input.fromUnitId, input.toUnitId],
    );

    if (assignedUnits.length !== 2) {
      throw new BadRequestException(
        'Both conversion units must be assigned to the stock item',
      );
    }

    const conversion = await this.unitsRepository.upsertConversion(
      {
        stockItemId_fromUnitId_toUnitId: {
          stockItemId: input.stockItemId,
          fromUnitId: input.fromUnitId,
          toUnitId: input.toUnitId,
        },
      },
      {
        id: randomUUID(),
        stockItemId: input.stockItemId,
        fromUnitId: input.fromUnitId,
        toUnitId: input.toUnitId,
        factor,
      },
      {
        factor,
      },
    );

    this.auditService.logCreate(
      'STOCK_ITEM_CONVERSION',
      conversion.id,
      conversion,
      {
        stockItemId: input.stockItemId,
        fromUnitId: input.fromUnitId,
        toUnitId: input.toUnitId,
      },
    );

    return conversion;
  }

  async listStockItemUnits(stockItemId: string) {
    await this.stockItemsService.getById(stockItemId);

    return this.unitsRepository.findStockItemUnits(stockItemId);
  }

  private normalizeCode(value: string) {
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');

    if (!normalized) {
      throw new BadRequestException('Code is required');
    }

    return normalized;
  }

  private toPositiveDecimal(
    value: string | number | Prisma.Decimal,
    fieldName: string,
  ) {
    const decimal = new Prisma.Decimal(value);

    if (decimal.lte(0)) {
      throw new BadRequestException(`${fieldName} must be greater than zero`);
    }

    return decimal;
  }
}
