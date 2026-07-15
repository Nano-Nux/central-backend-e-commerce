import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  StoreCategoryDetailResponseDto,
  StoreCategoryListQueryDto,
  StoreCategoryListResponseDto,
  StoreCategoryTreeQueryDto,
  StoreCategoryTreeResponseDto,
  StoreProductAvailabilityResponseDto,
  StoreProductCollectionResponseDto,
  StoreProductDetailResponseDto,
  StoreProductListQueryDto,
  StoreProductListResponseDto,
  StoreProductUnitCollectionResponseDto,
  StoreProductVariantCollectionResponseDto,
} from './dto/store-catalog.dto';
import { StoreCatalogService } from './store-catalog.service';
import { BrandService } from '../brand/brand.service';

@ApiTags('Store Catalog')
@Controller('store')
export class StoreCatalogController {
  constructor(
    private readonly storeCatalogService: StoreCatalogService,
    private readonly brandService: BrandService,
  ) {}

  @ApiOkResponse({ description: 'Active landing-page brand advertisements' })
  @Get('brands')
  async listBrands() {
    return { success: true, data: await this.brandService.listActive() };
  }

  @ApiOkResponse({ type: StoreCategoryListResponseDto })
  @Get('categories')
  async listCategories(@Query() query: StoreCategoryListQueryDto) {
    const result = await this.storeCatalogService.listCategories(query);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOkResponse({ type: StoreCategoryTreeResponseDto })
  @Get('categories/tree')
  async getCategoryTree(@Query() query: StoreCategoryTreeQueryDto) {
    return {
      success: true,
      data: await this.storeCatalogService.getCategoryTree(query),
    };
  }

  @ApiOkResponse({ type: StoreCategoryDetailResponseDto })
  @Get('categories/:slug')
  async getCategoryBySlug(@Param('slug') slug: string) {
    return {
      success: true,
      data: await this.storeCatalogService.getCategoryBySlug(slug),
    };
  }

  @ApiOkResponse({ type: StoreProductCollectionResponseDto })
  @Get('products/featured')
  async getFeaturedProducts() {
    return {
      success: true,
      data: await this.storeCatalogService.getFeaturedProducts(),
    };
  }

  @ApiOkResponse({ type: StoreProductCollectionResponseDto })
  @Get('products/new-arrivals')
  async getNewArrivals() {
    return {
      success: true,
      data: await this.storeCatalogService.getNewArrivals(),
    };
  }

  @ApiOkResponse({ type: StoreProductCollectionResponseDto })
  @Get('products/related/:slug')
  async getRelatedProducts(@Param('slug') slug: string) {
    return {
      success: true,
      data: await this.storeCatalogService.getRelatedProducts(slug),
    };
  }

  @ApiOkResponse({ type: StoreProductListResponseDto })
  @Get('products')
  async listProducts(@Query() query: StoreProductListQueryDto) {
    const result = await this.storeCatalogService.listProducts(query);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOkResponse({ type: StoreProductDetailResponseDto })
  @Get('products/:slug')
  async getProductBySlug(@Param('slug') slug: string) {
    return {
      success: true,
      data: await this.storeCatalogService.getProductBySlug(slug),
    };
  }

  @ApiOkResponse({ type: StoreProductAvailabilityResponseDto })
  @Get('products/:slug/availability')
  async getProductAvailability(@Param('slug') slug: string) {
    return {
      success: true,
      data: await this.storeCatalogService.getProductAvailability(slug),
    };
  }

  @ApiOkResponse({ type: StoreProductVariantCollectionResponseDto })
  @Get('products/:slug/variants')
  async getProductVariants(@Param('slug') slug: string) {
    return {
      success: true,
      data: await this.storeCatalogService.getProductVariants(slug),
    };
  }

  @ApiOkResponse({ type: StoreProductUnitCollectionResponseDto })
  @Get('products/:slug/units')
  async getProductUnits(@Param('slug') slug: string) {
    return {
      success: true,
      data: await this.storeCatalogService.getProductUnits(slug),
    };
  }
}
