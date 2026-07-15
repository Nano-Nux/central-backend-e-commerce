import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum StorefrontStockVisibility {
  IN_STOCK = 'IN_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  LOW_STOCK = 'LOW_STOCK',
}

export enum StorefrontProductSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
}

export class StorePaginationDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  hasNext!: boolean;

  @ApiProperty()
  hasPrevious!: boolean;
}

export class StoreCategoryParentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class StoreCategorySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  parentId?: string | null;

  @ApiProperty()
  productCount!: number;
}

export class StoreCategoryTreeNodeDto extends StoreCategorySummaryDto {
  @ApiProperty({ type: () => [StoreCategoryTreeNodeDto] })
  children!: StoreCategoryTreeNodeDto[];
}

export class StoreCategoryDetailDto extends StoreCategorySummaryDto {
  @ApiProperty({ type: () => [StoreCategoryParentDto] })
  breadcrumb!: StoreCategoryParentDto[];

  @ApiProperty({ type: () => [StoreCategorySummaryDto] })
  children!: StoreCategorySummaryDto[];
}

export class StoreCategoryListQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeEmpty?: boolean = true;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class StoreCategoryTreeQueryDto {
  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeEmpty?: boolean = true;
}

export class StoreProductCategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class StoreProductCardPriceDto {
  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  rule!: string;

  @ApiProperty()
  baseAmount!: string;
}

export class StoreProductCardDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  shortDescription?: string | null;

  @ApiPropertyOptional()
  primaryImageUrl?: string | null;

  @ApiPropertyOptional({ type: () => StoreProductCategoryDto })
  category?: StoreProductCategoryDto | null;

  @ApiProperty()
  productType!: string;

  @ApiProperty({ type: () => StoreProductCardPriceDto })
  price!: StoreProductCardPriceDto;

  @ApiProperty({ enum: StorefrontStockVisibility })
  stockVisibility!: StorefrontStockVisibility;

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class StoreProductAttributeDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  value!: string;
}

export class StoreProductVariantDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiPropertyOptional()
  barcode?: string | null;

  @ApiProperty({ type: Object })
  attributes!: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => StoreProductCardPriceDto })
  price?: StoreProductCardPriceDto;

  @ApiProperty({ enum: StorefrontStockVisibility })
  stockVisibility!: StorefrontStockVisibility;

  @ApiPropertyOptional()
  stockItemId?: string | null;
}

export class StoreProductUnitOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  unitId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  symbol?: string | null;

  @ApiProperty()
  conversionToBase!: string;

  @ApiProperty()
  isBaseUnit!: boolean;

  @ApiProperty()
  isSalesUnit!: boolean;

  @ApiProperty()
  allowsFractional!: boolean;
}

export class StoreProductStockItemOptionDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  variantId?: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ enum: StorefrontStockVisibility })
  stockVisibility!: StorefrontStockVisibility;

  @ApiProperty()
  quantityOnHand!: string;

  @ApiProperty()
  reservedQuantity!: string;

  @ApiProperty()
  availableQuantity!: string;

  @ApiProperty({ type: () => [StoreProductUnitOptionDto] })
  units!: StoreProductUnitOptionDto[];
}

export class StoreProductImageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  position!: number;
}

export class StoreProductDetailDto extends StoreProductCardDto {
  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ type: () => [StoreProductImageDto] })
  images!: StoreProductImageDto[];

  @ApiProperty({ type: () => [StoreProductAttributeDto] })
  attributes!: StoreProductAttributeDto[];

  @ApiProperty({ type: () => [StoreProductVariantDto] })
  variants!: StoreProductVariantDto[];

  @ApiProperty({ type: () => [StoreProductStockItemOptionDto] })
  stockItems!: StoreProductStockItemOptionDto[];
}

export class StoreProductAvailabilityDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: StorefrontStockVisibility })
  stockVisibility!: StorefrontStockVisibility;

  @ApiProperty({ type: () => [StoreProductStockItemOptionDto] })
  stockItems!: StoreProductStockItemOptionDto[];
}

export class StoreProductUnitGroupDto {
  @ApiProperty()
  stockItemId!: string;

  @ApiPropertyOptional()
  variantId?: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: () => [StoreProductUnitOptionDto] })
  units!: StoreProductUnitOptionDto[];
}

export class StoreProductListQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  inStock?: boolean;

  @ApiPropertyOptional({ enum: StorefrontProductSort })
  @IsEnum(StorefrontProductSort)
  @IsOptional()
  sort?: StorefrontProductSort = StorefrontProductSort.NEWEST;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class StoreCategoryListResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreCategorySummaryDto] })
  data!: StoreCategorySummaryDto[];

  @ApiProperty({ type: () => StorePaginationDto })
  pagination!: StorePaginationDto;
}

export class StoreCategoryTreeResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreCategoryTreeNodeDto] })
  data!: StoreCategoryTreeNodeDto[];
}

export class StoreCategoryDetailResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreCategoryDetailDto })
  data!: StoreCategoryDetailDto;
}

export class StoreProductListResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreProductCardDto] })
  data!: StoreProductCardDto[];

  @ApiProperty({ type: () => StorePaginationDto })
  pagination!: StorePaginationDto;
}

export class StoreProductDetailResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreProductDetailDto })
  data!: StoreProductDetailDto;
}

export class StoreProductCollectionResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreProductCardDto] })
  data!: StoreProductCardDto[];
}

export class StoreProductAvailabilityResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreProductAvailabilityDto })
  data!: StoreProductAvailabilityDto;
}

export class StoreProductVariantCollectionResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreProductVariantDto] })
  data!: StoreProductVariantDto[];
}

export class StoreProductUnitCollectionResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreProductUnitGroupDto] })
  data!: StoreProductUnitGroupDto[];
}
