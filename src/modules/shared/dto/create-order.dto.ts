import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { PricingCustomerType } from '../../product/pricing/pricing-rule.service';

export class CreateOrderItemDto {
  @ApiPropertyOptional()
  @ValidateIf((object: CreateOrderItemDto) => !object.barcode)
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @ValidateIf((object: CreateOrderItemDto) => !object.productId)
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiProperty({ type: () => Number })
  @Type(() => Number)
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ type: () => [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assetIds?: string[];

  @ApiPropertyOptional({ type: () => [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serialNumbers?: string[];
}

export class CreateOrderDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  @IsOptional()
  customerId?: string | null;

  @ApiPropertyOptional({ enum: PricingCustomerType })
  @IsEnum(PricingCustomerType)
  @IsOptional()
  customerType?: PricingCustomerType = PricingCustomerType.RETAIL;

  @ApiPropertyOptional({ type: () => Number })
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  discount?: number = 0;

  @ApiPropertyOptional({ type: () => Number })
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  tax?: number = 0;

  @ApiProperty({ type: () => [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
