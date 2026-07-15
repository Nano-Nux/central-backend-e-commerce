import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  BarcodeOwnerType,
  InventoryAssetStatus,
  InventoryReferenceType,
  InventoryTransformationLineDirection,
  InventoryTransformationType,
} from '../../../generated/prisma/enums';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class StockItemListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.ASC;
}

export class MovementListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InventoryReferenceType })
  @IsEnum(InventoryReferenceType)
  @IsOptional()
  referenceType?: InventoryReferenceType;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

export class BatchListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  batchCode?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresBefore?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAfter?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.ASC;
}

export class AssetListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  batchId?: string;

  @ApiPropertyOptional({ enum: InventoryAssetStatus })
  @IsEnum(InventoryAssetStatus)
  @IsOptional()
  status?: InventoryAssetStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

export class BarcodeListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BarcodeOwnerType })
  @IsEnum(BarcodeOwnerType)
  @IsOptional()
  ownerType?: BarcodeOwnerType;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  activeOnly?: boolean;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

export class UpdateBarcodeDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  symbology?: string;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class AssetSearchQueryDto extends AssetListQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  identifier?: string;
}

export class UpdateAssetDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assetTag?: string | null;

  @ApiPropertyOptional({ enum: InventoryAssetStatus })
  @IsEnum(InventoryAssetStatus)
  @IsOptional()
  status?: InventoryAssetStatus;
}

export class UnitListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  measurementGroupId?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.ASC;
}

export class ConversionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  fromUnitId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  toUnitId?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

export class TransformationListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InventoryTransformationType })
  @IsEnum(InventoryTransformationType)
  @IsOptional()
  type?: InventoryTransformationType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;
}

export class CreateTransformationLineDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ApiProperty()
  @IsUUID()
  stockItemId!: string;

  @ApiProperty({ enum: InventoryTransformationLineDirection })
  @IsEnum(InventoryTransformationLineDirection)
  direction!: InventoryTransformationLineDirection;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;
}

export class CreateTransformationDto {
  @ApiProperty({ enum: InventoryTransformationType })
  @IsEnum(InventoryTransformationType)
  type!: InventoryTransformationType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: () => [CreateTransformationLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTransformationLineDto)
  lines!: CreateTransformationLineDto[];
}

export class InventoryReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  days?: number = 30;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}
