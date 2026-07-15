import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class UnitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUnitByCode(code: string) {
    return this.prisma.unitDefinition.findUnique({
      where: { code },
    });
  }

  findUnitById(id: string) {
    return this.prisma.unitDefinition.findUnique({
      where: { id },
      include: {
        measurementGroup: true,
      },
    });
  }

  listUnits() {
    return this.prisma.unitDefinition.findMany({
      include: {
        measurementGroup: true,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  createMeasurementGroup(data: Prisma.MeasurementGroupUncheckedCreateInput) {
    return this.prisma.measurementGroup.create({ data });
  }

  findMeasurementGroupByCode(code: string) {
    return this.prisma.measurementGroup.findUnique({
      where: { code },
    });
  }

  createUnit(data: Prisma.UnitDefinitionUncheckedCreateInput) {
    return this.prisma.unitDefinition.create({ data });
  }

  assignUnitToStockItem(data: Prisma.StockItemUnitUncheckedCreateInput) {
    return this.prisma.stockItemUnit.create({ data });
  }

  findStockItemUnits(stockItemId: string) {
    return this.prisma.stockItemUnit.findMany({
      where: { stockItemId },
      include: {
        unit: true,
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findAssignedUnitIds(stockItemId: string, unitIds: string[]) {
    const rows = await this.prisma.stockItemUnit.findMany({
      where: {
        stockItemId,
        unitId: { in: unitIds },
      },
      select: { unitId: true },
    });

    return rows.map((row) => row.unitId);
  }

  upsertConversion(
    where: Prisma.StockItemUnitConversionWhereUniqueInput,
    create: Prisma.StockItemUnitConversionUncheckedCreateInput,
    update: Prisma.StockItemUnitConversionUncheckedUpdateInput,
  ) {
    return this.prisma.stockItemUnitConversion.upsert({
      where,
      create,
      update,
    });
  }

  findConversion(stockItemId: string, fromUnitId: string, toUnitId: string) {
    return this.prisma.stockItemUnitConversion.findUnique({
      where: {
        stockItemId_fromUnitId_toUnitId: {
          stockItemId,
          fromUnitId,
          toUnitId,
        },
      },
    });
  }
}
