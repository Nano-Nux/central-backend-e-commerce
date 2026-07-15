import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateGoodsReceiptAssetIdentifierDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  identifierTypeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  typeCode?: string;

  @ApiProperty()
  @IsString()
  value!: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateGoodsReceiptAssetDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assetTag?: string;

  @ApiProperty({ type: () => [CreateGoodsReceiptAssetIdentifierDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptAssetIdentifierDto)
  identifiers!: CreateGoodsReceiptAssetIdentifierDto[];
}

export class CreateGoodsReceiptItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ApiProperty({ type: () => Number })
  @Type(() => Number)
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ type: () => Number })
  @Type(() => Number)
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  batchCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ type: () => [CreateGoodsReceiptAssetDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptAssetDto)
  @IsOptional()
  assets?: CreateGoodsReceiptAssetDto[];
}

export class CreateGoodsReceiptDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty()
  @IsUUID()
  purchaseOrderId!: string;

  @ApiProperty()
  @IsUUID()
  receivedBy!: string;

  @ApiProperty({ type: () => [CreateGoodsReceiptItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items!: CreateGoodsReceiptItemDto[];
}
