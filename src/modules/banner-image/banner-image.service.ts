import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BannerImageRepository } from './banner-image.repository';
import { BannerImageListQueryDto } from './dto/banner-image-list-query.dto';
import { CreateBannerImageDto } from './dto/create-banner-image.dto';
import { UpdateBannerImageDto } from './dto/update-banner-image.dto';

@Injectable()
export class BannerImageService {
  constructor(private readonly repository: BannerImageRepository) {}

  create(dto: CreateBannerImageDto) {
    return this.repository.create({
      id: randomUUID(),
      imageUrl: dto.imageUrl,
      targetUrl: dto.targetUrl,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  listActive() {
    return this.repository.findActive();
  }

  async findAll(query: BannerImageListQueryDto) {
    const [data, total] = await Promise.all([
      this.repository.findAll(query.page, query.limit),
      this.repository.count(),
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

  async update(id: string, dto: UpdateBannerImageDto) {
    await this.getExisting(id);
    if (dto.displayOrder !== undefined && dto.displayOrder < 0) {
      throw new BadRequestException('Display order must not be negative');
    }
    return this.repository.update(id, {
      imageUrl: dto.imageUrl,
      targetUrl: dto.targetUrl,
      displayOrder: dto.displayOrder,
      isActive: dto.isActive,
    });
  }

  async delete(id: string) {
    await this.getExisting(id);
    return this.repository.delete(id);
  }

  private async getExisting(id: string) {
    const bannerImage = await this.repository.findById(id);
    if (!bannerImage) throw new NotFoundException('Banner image not found');
    return bannerImage;
  }
}
