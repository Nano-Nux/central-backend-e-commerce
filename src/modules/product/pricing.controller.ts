import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { PricingService } from '../pricing/pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class ProductPricingDto {
  @IsNumber() costPrice!: number;
  @IsNumber() sellingPrice!: number;
  @IsNumber() @IsOptional() wholesalePrice?: number | null;
  @IsNumber() @IsOptional() memberPrice?: number | null;
  @IsNumber() @IsOptional() promotionPrice?: number | null;
  @IsString() @IsOptional() variantId?: string | null;
  @IsString() @IsOptional() promotionStartAt?: string | null;
  @IsString() @IsOptional() promotionEndAt?: string | null;
}

@ApiTags('Product Pricing')
@Controller('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class ProductPricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get(':id/pricing')
  @ApiOperation({ summary: 'Get current product pricing' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.getCurrentPrice(id);
  }

  @Patch(':id/pricing')
  @Post(':id/pricing')
  @ApiOperation({ summary: 'Create or update product pricing' })
  set(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ProductPricingDto) {
    return this.pricingService.setPrice({ ...dto, productId: id });
  }
}
