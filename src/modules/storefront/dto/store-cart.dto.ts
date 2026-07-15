import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { StoreProductCardPriceDto, StorefrontStockVisibility } from './store-catalog.dto';

export class StoreCartItemMutationDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ApiProperty()
  @Type(() => Number)
  @Min(0.001)
  quantity!: number;
}

export class UpdateStoreCartItemDto {
  @ApiProperty()
  @Type(() => Number)
  @Min(0.001)
  quantity!: number;
}

export class MergeStoreCartDto {
  @ApiProperty({ type: () => [StoreCartItemMutationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StoreCartItemMutationDto)
  items!: StoreCartItemMutationDto[];
}

export class StoreCartItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  lineKey!: string;

  @ApiProperty()
  productId!: string;

  @ApiPropertyOptional()
  variantId?: string | null;

  @ApiPropertyOptional()
  stockItemId?: string | null;

  @ApiPropertyOptional()
  unitId?: string | null;

  @ApiProperty()
  productName!: string;

  @ApiPropertyOptional()
  variantName?: string | null;

  @ApiPropertyOptional()
  unitName?: string | null;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  baseQuantity!: string;

  @ApiProperty({ type: () => StoreProductCardPriceDto })
  unitPrice!: StoreProductCardPriceDto;

  @ApiProperty()
  lineTotal!: string;

  @ApiProperty({ enum: StorefrontStockVisibility })
  stockVisibility!: StorefrontStockVisibility;
}

export class StoreCartDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty({ type: () => [StoreCartItemDto] })
  items!: StoreCartItemDto[];
}

export class StoreCartResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreCartDto })
  data!: StoreCartDto;
}
