import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../generated/prisma/client';
import { BrandListQueryDto } from './dto/brand-list-query.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandRepository } from './brand.repository';

@Injectable()
export class BrandService {
  constructor(private readonly repository: BrandRepository) {}

  async create(dto: CreateBrandDto) {
    const name = this.normalizeName(dto.name);
    await this.ensureUnique(name);
    const id = randomUUID();
    try {
      return await this.repository.create({
        id,
        name,
        imageUrl: dto.imageUrl,
        targetUrl: dto.targetUrl,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
      });
    } catch (error) {
      this.throwDuplicate(error);
    }
  }

  listActive() {
    return this.repository.findActive();
  }

  async findAll(query: BrandListQueryDto) {
    const [data, total] = await Promise.all([
      this.repository.findAll(query.page, query.limit, query.q),
      this.repository.count(query.q),
    ]);
    const totalPages = Math.ceil(total / query.limit);
    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrevious: query.page > 1,
      },
    };
  }

  findOne(id: string) {
    return this.getExisting(id);
  }

  async update(id: string, dto: UpdateBrandDto) {
    const brand = await this.getExisting(id);
    const name = dto.name === undefined ? undefined : this.normalizeName(dto.name);
    if (name) await this.ensureUnique(name, brand.id);
    try {
      return await this.repository.update(id, {
        name,
        imageUrl: dto.imageUrl,
        targetUrl: dto.targetUrl,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
      });
    } catch (error) {
      this.throwDuplicate(error);
    }
  }

  async delete(id: string) {
    await this.getExisting(id);
    try {
      return await this.repository.delete(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Brand could not be deleted');
      }
      throw error;
    }
  }

  private async getExisting(id: string) {
    const brand = await this.repository.findById(id);
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  private normalizeName(name?: string) {
    const value = name?.trim();
    if (!value) throw new BadRequestException('Brand name is required');
    return value;
  }

  private async ensureUnique(name: string, excludeId?: string) {
    if (await this.repository.findByExactName(name, excludeId)) {
      throw new ConflictException('Brand name already exists');
    }
  }

  private throwDuplicate(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Brand name already exists');
    }
    throw error;
  }
}
