import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import { buildStableSlug } from '../../common/utils/slug.util';
import { CreateCategoryDto } from '../shared/dto/create-category.dto';
import { UpdateCategoryDto } from '../shared/dto/update-category.dto';
import { CategoryListQueryDto } from '../shared/dto/category-list-query.dto';
import { CategoryRepository } from './category.repository';

type CategoryRecord = NonNullable<
  Awaited<ReturnType<CategoryRepository['findById']>>
>;
type CategoryTreeNode = CategoryRecord & { children: CategoryTreeNode[] };

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const name = this.normalizeName(createCategoryDto.name);
    await this.ensureNameIsUnique(name);
    const id = randomUUID();
    const parent = createCategoryDto.parentId
      ? await this.getExistingCategory(createCategoryDto.parentId)
      : null;

    try {
      return await this.categoryRepository.create({
        id,
        name,
        label: createCategoryDto.label,
        slug: buildStableSlug(name, id.slice(0, 8)),
        parentId: parent?.id,
        description: createCategoryDto.description,
        path: this.buildPath(id, parent?.path),
      });
    } catch (error) {
      this.throwOnDuplicateName(error);
    }
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.getExistingCategory(id);
    const name =
      updateCategoryDto.name === undefined
        ? undefined
        : this.normalizeName(updateCategoryDto.name);

    if (name) {
      await this.ensureNameIsUnique(name, category.id);
    }
    const parentWasProvided = Object.prototype.hasOwnProperty.call(
      updateCategoryDto,
      'parentId',
    );
    const parent = parentWasProvided
      ? await this.resolveParentForUpdate(category, updateCategoryDto.parentId)
      : undefined;
    const nextPath = parentWasProvided
      ? this.buildPath(category.id, parent?.path)
      : category.path;
    const updateData = {
      name,
      label: updateCategoryDto.label,
      slug: name
        ? buildStableSlug(name, category.id.slice(0, 8))
        : undefined,
      description: updateCategoryDto.description,
      parentId: parentWasProvided ? (parent?.id ?? null) : undefined,
      path: nextPath,
    };

    try {
      if (nextPath === category.path) {
        return await this.categoryRepository.update(id, updateData);
      }

      const descendants = await this.categoryRepository.findDescendants(
        category.path,
      );
      const descendantUpdates = descendants.map((descendant) => ({
        id: descendant.id,
        path: descendant.path.replace(category.path, nextPath),
      }));

      return await this.categoryRepository.updateWithDescendantPaths(
        id,
        updateData,
        descendantUpdates,
      );
    } catch (error) {
      this.throwOnDuplicateName(error);
    }
  }

  async delete(id: string) {
    const category = await this.getExistingCategory(id);
    const [childCount, productCount] = await Promise.all([
      this.categoryRepository.countChildren(category.id),
      this.categoryRepository.countProducts(category.id),
    ]);

    if (childCount > 0 || productCount > 0) {
      throw new ConflictException(
        'Category cannot be deleted while it has child categories or products',
      );
    }

    try {
      return await this.categoryRepository.delete(category.id);
    } catch (error) {
      this.throwOnProtectedDelete(error);
    }
  }

  async getTree() {
    const categories = await this.categoryRepository.findAllForTree();
    const nodeMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const category of categories) {
      nodeMap.set(category.id, { ...category, children: [] });
    }

    for (const category of categories) {
      const node = nodeMap.get(category.id);

      if (!node) {
        continue;
      }

      if (category.parentId) {
        const parent = nodeMap.get(category.parentId);

        if (parent) {
          parent.children.push(node);
          continue;
        }
      }

      roots.push(node);
    }

    return roots;
  }

  list(query: CategoryListQueryDto) {
    return this.categoryRepository.findAll(query.label);
  }

  async findOne(id: string) {
    return this.getExistingCategory(id);
  }

  private async getExistingCategory(id: string) {
    const category = await this.categoryRepository.findById(id);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private async resolveParentForUpdate(
    category: CategoryRecord,
    parentId: string | null | undefined,
  ) {
    if (!parentId) {
      return null;
    }

    if (parentId === category.id) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    const parent = await this.getExistingCategory(parentId);

    if (
      parent.path === category.path ||
      parent.path.startsWith(`${category.path}/`)
    ) {
      throw new BadRequestException(
        'Category cannot be moved under its descendant',
      );
    }

    return parent;
  }

  private buildPath(id: string, parentPath?: string | null) {
    return parentPath ? `${parentPath}/${id}` : `/${id}`;
  }

  private normalizeName(name?: string) {
    const normalized = name?.trim();

    if (!normalized) {
      throw new BadRequestException('Category name is required');
    }

    return normalized;
  }

  private async ensureNameIsUnique(name: string, excludeId?: string) {
    const existingCategory = await this.categoryRepository.findByExactName(
      name,
      excludeId,
    );

    if (existingCategory) {
      throw new BadRequestException('Category name already exists');
    }
  }

  private throwOnDuplicateName(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Category name already exists');
    }

    throw error;
  }

  private throwOnProtectedDelete(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictException(
        'Category cannot be deleted while it has child categories or products',
      );
    }

    throw error;
  }
}
