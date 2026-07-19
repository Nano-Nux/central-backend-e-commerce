import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const brandSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  targetUrl: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class BrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.BrandUncheckedCreateInput) {
    return this.prisma.brand.create({ data, select: brandSelect });
  }

  findById(id: string) {
    return this.prisma.brand.findUnique({ where: { id }, select: brandSelect });
  }

  findByExactName(name: string, excludeId?: string) {
    return this.prisma.brand.findFirst({
      where: { name, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, name: true },
    });
  }

  findActive() {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      select: brandSelect,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAll(page: number, limit: number, q?: string) {
    const where: Prisma.BrandWhereInput = q?.trim()
      ? { name: { contains: q.trim() } }
      : {};
    return this.prisma.brand.findMany({
      where,
      select: brandSelect,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(q?: string) {
    const where: Prisma.BrandWhereInput = q?.trim()
      ? { name: { contains: q.trim() } }
      : {};
    return this.prisma.brand.count({ where });
  }

  update(id: string, data: Prisma.BrandUncheckedUpdateInput) {
    return this.prisma.brand.update({ where: { id }, data, select: brandSelect });
  }

  delete(id: string) {
    return this.prisma.brand.delete({ where: { id }, select: brandSelect });
  }
}
