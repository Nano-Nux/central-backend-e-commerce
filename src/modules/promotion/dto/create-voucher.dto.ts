import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PromotionDiscountType } from '../../../../generated/prisma/enums';

export class CreateVoucherDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  code!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: PromotionDiscountType })
  @IsEnum(PromotionDiscountType)
  discountType!: PromotionDiscountType;

  @ApiProperty()
  @Type(() => Number)
  @Min(0.01)
  discountValue!: number;

  @ApiPropertyOptional({ default: 0 })
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  minimumOrderAmount?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startAt?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endAt?: Date;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  isActive?: boolean;
}
