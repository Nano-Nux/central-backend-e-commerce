import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { SortOrder } from '../inventory/inventory-read.dto';

import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { ProductService } from './product.service';
import { VariantReadService } from './variant-read.service';

class VariantListQueryDto extends PaginationQueryDto {
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
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.ASC;
}

class VariantAssetListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

class UpdateVariantDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  barcode?: string | null;
}

@ApiTags('Products')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class VariantController {
  constructor(
    private readonly productService: ProductService,
    private readonly variantReadService: VariantReadService,
  ) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('products/:id/variants')
  async listProductVariants(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VariantListQueryDto,
  ) {
    const result = await this.variantReadService.listProductVariants(id, query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('variants/:id')
  async getVariant(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Success',
      data: await this.variantReadService.getVariant(id),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('variants/:id/history')
  async getVariantHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    const result = await this.variantReadService.getVariantHistory(id, query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Patch('variants/:id')
  async updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
  ) {
    const variant = await this.variantReadService.getVariant(id);

    return {
      success: true,
      message: 'Product variant updated successfully',
      data: await this.productService.updateVariant(variant.productId, id, dto),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Delete('variants/:id')
  async deleteVariant(@Param('id', ParseUUIDPipe) id: string) {
    const variant = await this.variantReadService.getVariant(id);

    return {
      success: true,
      message: 'Product variant deleted successfully',
      data: await this.productService.deleteVariant(variant.productId, id),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('variants/:id/inventory')
  async getVariantInventory(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Success',
      data: await this.variantReadService.getVariantInventory(id),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('variants/:id/assets')
  async getVariantAssets(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VariantAssetListQueryDto,
  ) {
    const result = await this.variantReadService.getVariantAssets(id, query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('variants/:id/batches')
  async getVariantBatches(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    const result = await this.variantReadService.getVariantBatches(id, query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }
}
