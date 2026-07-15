import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class CustomerTagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CustomerTagCreateInput) {
    return this.prisma.customerTag.create({ data });
  }

  findMany() {
    return this.prisma.customerTag.findMany({
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.customerTag.findUnique({
      where: { id },
    });
  }

  assign(customerId: string, tagId: string) {
    return this.prisma.customerTagMap.upsert({
      where: {
        customerId_tagId: {
          customerId,
          tagId,
        },
      },
      create: {
        customerId,
        tagId,
      },
      update: {},
    });
  }

  remove(customerId: string, tagId: string) {
    return this.prisma.customerTagMap.delete({
      where: {
        customerId_tagId: {
          customerId,
          tagId,
        },
      },
    });
  }
}
