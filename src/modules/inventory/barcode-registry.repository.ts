import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class BarcodeRegistryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByNormalizedCode(normalizedCode: string) {
    return this.prisma.barcodeRegistry.findFirst({
      where: {
        normalizedCode,
        isActive: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findAnyByNormalizedCode(normalizedCode: string) {
    return this.prisma.barcodeRegistry.findUnique({
      where: { normalizedCode },
    });
  }

  create(data: Prisma.BarcodeRegistryUncheckedCreateInput) {
    return this.prisma.barcodeRegistry.create({ data });
  }
}
