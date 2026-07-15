import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../generated/prisma/client';
import { PromotionDiscountType } from '../../../generated/prisma/enums';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { ValidateVoucherDto } from './dto/validate-voucher.dto';
import { VoucherListQueryDto } from './dto/voucher-list-query.dto';
import { PromotionRepository } from './promotion.repository';

@Injectable()
export class PromotionService {
  constructor(private readonly repository: PromotionRepository) {}

  async create(dto: CreateVoucherDto) {
    const code = this.normalizeCode(dto.code);
    this.validateDates(dto.startAt, dto.endAt);
    this.validateDiscount(dto.discountType, dto.discountValue);
    try {
      return await this.repository.create({
        id: randomUUID(), code, description: dto.description,
        discountType: dto.discountType, discountValue: dto.discountValue,
        minimumOrderAmount: dto.minimumOrderAmount ?? 0,
        startAt: dto.startAt, endAt: dto.endAt, usageLimit: dto.usageLimit,
        isActive: dto.isActive ?? true,
      });
    } catch (error) { this.throwDuplicate(error); }
  }

  async list(query: VoucherListQueryDto) {
    const [data, total] = await Promise.all([
      this.repository.findAll(query.page, query.limit, query.q),
      this.repository.count(query.q),
    ]);
    const totalPages = Math.ceil(total / query.limit);
    return { data, pagination: { page: query.page, limit: query.limit, total, totalPages, hasNext: query.page < totalPages, hasPrevious: query.page > 1 } };
  }

  findOne(id: string) { return this.getExisting(id); }

  async update(id: string, dto: UpdateVoucherDto) {
    await this.getExisting(id);
    this.validateDates(dto.startAt, dto.endAt);
    if (dto.discountType && dto.discountValue !== undefined) this.validateDiscount(dto.discountType, dto.discountValue);
    try {
      return await this.repository.update(id, {
        code: dto.code === undefined ? undefined : this.normalizeCode(dto.code),
        description: dto.description, discountType: dto.discountType,
        discountValue: dto.discountValue, minimumOrderAmount: dto.minimumOrderAmount,
        startAt: dto.startAt, endAt: dto.endAt, usageLimit: dto.usageLimit,
        isActive: dto.isActive,
      });
    } catch (error) { this.throwDuplicate(error); }
  }

  async delete(id: string) { await this.getExisting(id); return this.repository.delete(id); }

  async validate(dto: ValidateVoucherDto) {
    const code = this.normalizeCode(dto.code);
    const voucher = await this.repository.findByCode(code);
    if (!voucher) throw new NotFoundException('Invalid voucher code');
    const now = new Date();
    if (!voucher.isActive) throw new BadRequestException('Voucher is inactive');
    if (voucher.startAt && now < voucher.startAt) throw new BadRequestException('Voucher is not yet active');
    if (voucher.endAt && now > voucher.endAt) throw new BadRequestException('Voucher has expired');
    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) throw new BadRequestException('Voucher usage limit reached');
    const cartTotal = new Prisma.Decimal(dto.cartTotal);
    if (cartTotal.lt(voucher.minimumOrderAmount)) throw new BadRequestException(`Minimum order amount is ${voucher.minimumOrderAmount.toString()}`);
    const rawDiscount = voucher.discountType === PromotionDiscountType.PERCENTAGE
      ? cartTotal.mul(voucher.discountValue).div(100) : voucher.discountValue;
    const discount = Prisma.Decimal.min(rawDiscount, cartTotal);
    return { voucherId: voucher.id, code: voucher.code, discountType: voucher.discountType, discountValue: voucher.discountValue.toString(), discountAmount: discount.toString() };
  }

  async consume(voucherId: string, transaction: Prisma.TransactionClient) {
    const result = await this.repository.consume(voucherId, transaction);
    if (result !== 1) throw new ConflictException('Voucher usage limit reached');
  }

  private async getExisting(id: string) { const voucher = await this.repository.findById(id); if (!voucher) throw new NotFoundException('Voucher not found'); return voucher; }
  private normalizeCode(code: string) { const value = code?.trim().toUpperCase(); if (!value) throw new BadRequestException('Voucher code is required'); return value; }
  private validateDates(startAt?: Date, endAt?: Date) { if (startAt && endAt && startAt > endAt) throw new BadRequestException('Voucher end date must be after start date'); }
  private validateDiscount(type?: PromotionDiscountType, value?: number) { if (value === undefined || value <= 0) throw new BadRequestException('Discount value must be greater than zero'); if (type === PromotionDiscountType.PERCENTAGE && value > 100) throw new BadRequestException('Percentage discount cannot exceed 100'); }
  private throwDuplicate(error: unknown): never { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Voucher code already exists'); throw error; }
}
