import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CatalogLabel } from '../catalog-label';

export class CategoryListQueryDto {
  @ApiPropertyOptional({ enum: CatalogLabel })
  @IsEnum(CatalogLabel)
  @IsOptional()
  label?: CatalogLabel;
}
