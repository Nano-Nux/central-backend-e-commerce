import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignProductCategoryDto } from '../shared/dto/assign-product-category.dto';
import { CreateProductDto } from '../shared/dto/create-product.dto';
import { ProductListQueryDto } from '../shared/dto/product-list-query.dto';
import { UpdateProductDto } from '../shared/dto/update-product.dto';
import { ProductService } from './product.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

class CreateProductVariantDto {
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

class UpdateProductVariantDto {
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

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;
}

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    const product = await this.productService.create(createProductDto);

    return {
      success: true,
      message: 'Product created successfully',
      data: product,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll(@Query() query: ProductListQueryDto) {
    const result = await this.productService.findAll(query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const product = await this.productService.findOne(id);

    return {
      success: true,
      message: 'Success',
      data: product,
    };
  }

  @ApiOperation({ summary: 'Get product inventory' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id/inventory')
  async inventory(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Success',
      data: await this.productService.findInventory(id),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const product = await this.productService.update(id, updateProductDto);

    return {
      success: true,
      message: 'Product updated successfully',
      data: product,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Patch(':id/category')
  async assignCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignProductCategoryDto: AssignProductCategoryDto,
  ) {
    const product = await this.productService.assignCategory(
      id,
      assignProductCategoryDto,
    );

    return {
      success: true,
      message: 'Product category updated successfully',
      data: product,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Delete(':id')
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const product = await this.productService.deactivate(id);

    return {
      success: true,
      message: 'Product deactivated successfully',
      data: product,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(':id/variants')
  async createVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return {
      success: true,
      message: 'Product variant created successfully',
      data: await this.productService.createVariant(id, dto),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Patch(':id/variants/:variantId')
  async updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return {
      success: true,
      message: 'Product variant updated successfully',
      data: await this.productService.updateVariant(id, variantId, dto),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Post(':id/variants/:variantId/deactivate')
  async deactivateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return {
      success: true,
      message: 'Product variant deactivated successfully',
      data: await this.productService.deactivateVariant(id, variantId),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Post(':id/variants/:variantId/reactivate')
  async reactivateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return {
      success: true,
      message: 'Product variant reactivated successfully',
      data: await this.productService.reactivateVariant(id, variantId),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Delete(':id/variants/:variantId')
  async deleteVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return {
      success: true,
      message: 'Product variant deleted successfully',
      data: await this.productService.deleteVariant(id, variantId),
    };
  }
}
