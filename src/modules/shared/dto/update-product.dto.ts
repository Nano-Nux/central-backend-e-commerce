import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { ProductType } from '../../../../generated/prisma/enums';

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  sku?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  barcode?: string | null;

  @ApiPropertyOptional({ enum: ProductType })
  @IsEnum(ProductType)
  @IsOptional()
  type?: ProductType;

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
}
