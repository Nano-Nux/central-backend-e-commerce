import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const categorySelect = {
  id: true,
  name: true,
  label: true,
  slug: true,
  parentId: true,
  description: true,
  imageUrl: true,
  path: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CategoryUncheckedCreateInput) {
    return this.prisma.category.create({
      data,
      select: categorySelect,
    });
  }

  findById(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      select: categorySelect,
    });
  }

  delete(id: string) {
    return this.prisma.category.delete({
      where: { id },
      select: categorySelect,
    });
  }

  async findByExactName(name: string, excludeId?: string) {
    const categories = await this.prisma.category.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined,
      select: {
        id: true,
        name: true,
      },
    });

    return (
      categories.find((category) => category.name === name) ?? null
    );
  }

  findDescendants(path: string) {
    return this.prisma.category.findMany({
      where: {
        path: {
          startsWith: `${path}/`,
        },
      },
      select: categorySelect,
      orderBy: {
        path: 'asc',
      },
    });
  }

  findAllForTree() {
    return this.prisma.category.findMany({
      select: categorySelect,
      orderBy: {
        path: 'asc',
      },
    });
  }

  findAll(label?: Prisma.CategoryWhereInput['label']) {
    return this.prisma.category.findMany({
      where: label ? { label } : undefined,
      select: categorySelect,
      orderBy: [{ name: 'asc' }],
    });
  }

  countChildren(id: string) {
    return this.prisma.category.count({
      where: { parentId: id },
    });
  }

  countProducts(id: string) {
    return this.prisma.productCategory.count({
      where: { categoryId: id, product: { isActive: true } },
    });
  }

  update(id: string, data: Prisma.CategoryUncheckedUpdateInput) {
    return this.prisma.category.update({
      where: { id },
      data,
      select: categorySelect,
    });
  }

  updateWithDescendantPaths(
    id: string,
    data: Prisma.CategoryUncheckedUpdateInput,
    descendants: Array<{ id: string; path: string }>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const category = await transaction.category.update({
        where: { id },
        data,
        select: categorySelect,
      });

      for (const descendant of descendants) {
        await transaction.category.update({
          where: { id: descendant.id },
          data: { path: descendant.path },
        });
      }

      return category;
    });
  }
}
