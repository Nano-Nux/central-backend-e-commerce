import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CatalogLabel } from '../catalog-label';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ enum: CatalogLabel })
  @IsEnum(CatalogLabel)
  @IsOptional()
  label?: CatalogLabel;

  @ApiPropertyOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string | null;
}
