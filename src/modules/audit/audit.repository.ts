import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AuditLogUncheckedCreateInput) {
    return this.prisma.auditLog.create({ data });
  }

  findMany(params: {
    entityType?: string;
    entityId?: string;
    action?: string;
    skip?: number;
    take?: number;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
      },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  count(params: { entityType?: string; entityId?: string; action?: string }) {
    return this.prisma.auditLog.count({
      where: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
      },
    });
  }
}
