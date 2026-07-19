import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const bannerImageSelect = {
  id: true,
  imageUrl: true,
  targetUrl: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class BannerImageRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.BannerImageUncheckedCreateInput) {
    return this.prisma.bannerImage.create({ data, select: bannerImageSelect });
  }

  findById(id: string) {
    return this.prisma.bannerImage.findUnique({ where: { id }, select: bannerImageSelect });
  }

  findActive() {
    return this.prisma.bannerImage.findMany({
      where: { isActive: true },
      select: bannerImageSelect,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findAll(page: number, limit: number) {
    return this.prisma.bannerImage.findMany({
      select: bannerImageSelect,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count() {
    return this.prisma.bannerImage.count();
  }

  update(id: string, data: Prisma.BannerImageUncheckedUpdateInput) {
    return this.prisma.bannerImage.update({ where: { id }, data, select: bannerImageSelect });
  }

  delete(id: string) {
    return this.prisma.bannerImage.delete({ where: { id }, select: bannerImageSelect });
  }
}
