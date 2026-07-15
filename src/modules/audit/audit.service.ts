import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { AuditRepository } from './audit.repository';
import {
  createPaginationMeta,
  normalizePagination,
} from '../shared/helpers/pagination.helper';

export type AuditJson = Prisma.InputJsonValue | null;

export type AuditContext = {
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  async list(query: { page?: number; limit?: number; actorId?: string; action?: string; entityType?: string; entityId?: string }) {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const where = { actorId: query.actorId, action: query.action, entityType: query.entityType, entityId: query.entityId };
    const [data, total] = await Promise.all([
      this.auditRepository.findMany({ ...where, skip, take }),
      this.auditRepository.count(where),
    ]);
    return { data, pagination: createPaginationMeta(page, limit, total) };
  }

  logCreate(
    entityType: string,
    entityId: string,
    after: AuditJson,
    metadata?: AuditJson,
    context?: AuditContext,
  ): void {
    this.logAction(
      'CREATE',
      entityType,
      entityId,
      undefined,
      after,
      metadata,
      context,
    );
  }

  logUpdate(
    entityType: string,
    entityId: string,
    before: AuditJson,
    after: AuditJson,
    metadata?: AuditJson,
    context?: AuditContext,
  ): void {
    this.logAction(
      'UPDATE',
      entityType,
      entityId,
      before,
      after,
      metadata,
      context,
    );
  }

  logDelete(
    entityType: string,
    entityId: string,
    before: AuditJson,
    metadata?: AuditJson,
    context?: AuditContext,
  ): void {
    this.logAction(
      'DELETE',
      entityType,
      entityId,
      before,
      undefined,
      metadata,
      context,
    );
  }

  logAction(
    action: string,
    entityType: string,
    entityId: string,
    before?: AuditJson,
    after?: AuditJson,
    metadata?: AuditJson,
    context?: AuditContext,
  ): void {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action,
      entityType,
      entityId,
      actorId: context?.actorId ?? undefined,
      before: before ?? undefined,
      after: after ?? undefined,
      metadata: metadata ?? undefined,
      ipAddress: context?.ipAddress ?? undefined,
      userAgent: context?.userAgent ?? undefined,
    };

    void this.auditRepository.create(data).catch((error: unknown) => {
      this.logger.error(
        `Failed to persist audit log ${action}:${entityType}:${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async listEntityHistory(
    entityType: string,
    entityId: string,
    query?: { page?: number; limit?: number; action?: string },
  ) {
    const { page, limit, skip, take } = normalizePagination(
      query?.page,
      query?.limit,
    );
    const [data, total] = await Promise.all([
      this.auditRepository.findMany({
        entityType,
        entityId,
        action: query?.action,
        skip,
        take,
      }),
      this.auditRepository.count({
        entityType,
        entityId,
        action: query?.action,
      }),
    ]);

    return {
      data,
      pagination: createPaginationMeta(page, limit, total),
    };
  }
}
