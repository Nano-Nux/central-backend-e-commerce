import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { ProductType } from '../../../../generated/prisma/enums';

export class CreateProductVariantDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  sku!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  barcode?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  attributes!: Record<string, unknown>;
}

export class CreateProductImageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  position?: number;
}

export class CreateProductAttributeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  key!: string;

  @ApiProperty()
  @IsString()
  value!: string;
}

export class CreateProductPricingDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  costPrice!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  sellingPrice!: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  wholesalePrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  memberPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  promotionPrice?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  promotionStartAt?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  promotionEndAt?: string;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  barcode?: string;

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  type!: ProductType;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isStockTracked?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isSerialized?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsUUID('4', { each: true })
  @IsOptional()
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsUUID('4', { each: true })
  @IsOptional()
  brandIds?: string[];

  @ApiPropertyOptional({ type: () => [CreateProductVariantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  @IsOptional()
  variants?: CreateProductVariantDto[];

  @ApiPropertyOptional({ type: () => [CreateProductImageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  @IsOptional()
  images?: CreateProductImageDto[];

  @ApiPropertyOptional({ type: () => [CreateProductAttributeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  @IsOptional()
  attributes?: CreateProductAttributeDto[];

  @ApiPropertyOptional({ type: () => CreateProductPricingDto })
  @ValidateNested()
  @Type(() => CreateProductPricingDto)
  @IsOptional()
  pricing?: CreateProductPricingDto;
}
