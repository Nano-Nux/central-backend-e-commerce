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
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { BarcodeOwnerType, StockTrackingMode } from '../../../generated/prisma/enums';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryAdminService } from './inventory-admin.service';

class ProvisionStockItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;
}

class UpdateStockItemConfigurationDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  trackBatches?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  trackExpiry?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  trackUniqueAssets?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  trackReservations?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowUnitConversions?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowPackBreaking?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowMultipleBarcodes?: boolean;

  @ApiPropertyOptional({ enum: StockTrackingMode })
  @IsEnum(StockTrackingMode)
  @IsOptional()
  trackingMode?: StockTrackingMode;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  baseUnitId?: string | null;
}

class IdentifierTypeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  code!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  validationRegex?: string;
}

class UpdateIdentifierTypeDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  validationRegex?: string | null;
}

class StockItemIdentifierRuleDto {
  @ApiProperty()
  @IsUUID()
  identifierTypeId!: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  minCount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCount?: number | null;
}

class MeasurementGroupDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  code!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;
}

class UpdateMeasurementGroupDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;
}

class UnitDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  code!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  measurementGroupId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowsDecimal?: boolean;
}

class UpdateUnitDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  symbol?: string | null;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  measurementGroupId?: string | null;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowsDecimal?: boolean;
}

class AssignStockItemUnitDto {
  @ApiProperty()
  @IsUUID()
  stockItemId!: string;

  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.000001)
  conversionToBase!: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isBaseUnit?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isSalesUnit?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPurchaseUnit?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowsFractional?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  position?: number;
}

class StockItemConversionDto {
  @ApiProperty()
  @IsUUID()
  stockItemId!: string;

  @ApiProperty()
  @IsUUID()
  fromUnitId!: string;

  @ApiProperty()
  @IsUUID()
  toUnitId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.000001)
  factor!: number;
}

class BarcodeDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  symbology!: string;

  @ApiProperty({ enum: BarcodeOwnerType })
  @IsEnum(BarcodeOwnerType)
  ownerType!: BarcodeOwnerType;

  @ApiProperty()
  @IsString()
  ownerId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemUnitId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inventoryAssetId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inventoryBatchId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

class GenerateBarcodeDto {
  @ApiProperty({ enum: BarcodeOwnerType })
  @IsEnum(BarcodeOwnerType)
  ownerType!: BarcodeOwnerType;

  @ApiProperty()
  @IsString()
  ownerId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemUnitId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inventoryAssetId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inventoryBatchId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

class ReplaceBarcodeDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  symbology?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  makePrimary?: boolean;
}

@ApiTags('Inventory Admin')
@ApiBearerAuth()
@Controller('inventory/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class InventoryAdminController {
  constructor(private readonly inventoryAdminService: InventoryAdminService) {}

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('stock-items')
  async listStockItems(
    @Query('productId') productId?: string,
    @Query('variantId') variantId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.listStockItems({
        productId,
        variantId,
        isActive:
          isActive === undefined
            ? undefined
            : isActive === 'true'
              ? true
              : isActive === 'false'
                ? false
                : undefined,
      }),
    };
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('stock-items/provision')
  async provisionStockItem(@Body() dto: ProvisionStockItemDto) {
    return {
      success: true,
      message: 'Stock item provisioned successfully',
      data: await this.inventoryAdminService.provisionStockItem(dto),
    };
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('stock-items/:stockItemId/configuration')
  async getStockItemConfiguration(
    @Param('stockItemId', ParseUUIDPipe) stockItemId: string,
  ) {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.getStockItemConfiguration(stockItemId),
    };
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Patch('stock-items/:stockItemId/configuration')
  async updateStockItemConfiguration(
    @Param('stockItemId', ParseUUIDPipe) stockItemId: string,
    @Body() dto: UpdateStockItemConfigurationDto,
  ) {
    return {
      success: true,
      message: 'Stock item configuration updated successfully',
      data: await this.inventoryAdminService.updateStockItemConfiguration(
        stockItemId,
        dto,
      ),
    };
  }

  @Get('identifier-types')
  async listIdentifierTypes(@Query('q') q?: string) {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.listIdentifierTypes(q),
    };
  }

  @Post('identifier-types')
  async createIdentifierType(@Body() dto: IdentifierTypeDto) {
    return {
      success: true,
      message: 'Identifier type created successfully',
      data: await this.inventoryAdminService.createIdentifierType(dto),
    };
  }

  @Patch('identifier-types/:id')
  async updateIdentifierType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIdentifierTypeDto,
  ) {
    return {
      success: true,
      message: 'Identifier type updated successfully',
      data: await this.inventoryAdminService.updateIdentifierType(id, dto),
    };
  }

  @Post('identifier-types/:id/archive')
  async archiveIdentifierType(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Identifier type archived successfully',
      data: await this.inventoryAdminService.archiveIdentifierType(id),
    };
  }

  @Post('identifier-types/:id/restore')
  async restoreIdentifierType(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Identifier type restored successfully',
      data: await this.inventoryAdminService.restoreIdentifierType(id),
    };
  }

  @Get('stock-items/:stockItemId/identifier-rules')
  async listStockItemIdentifierRules(
    @Param('stockItemId', ParseUUIDPipe) stockItemId: string,
  ) {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.listStockItemIdentifierRules(stockItemId),
    };
  }

  @Post('stock-items/:stockItemId/identifier-rules')
  async upsertStockItemIdentifierRule(
    @Param('stockItemId', ParseUUIDPipe) stockItemId: string,
    @Body() dto: StockItemIdentifierRuleDto,
  ) {
    return {
      success: true,
      message: 'Stock item identifier rule saved successfully',
      data: await this.inventoryAdminService.upsertStockItemIdentifierRule(
        stockItemId,
        dto,
      ),
    };
  }

  @Delete('stock-items/:stockItemId/identifier-rules/:identifierTypeId')
  async removeStockItemIdentifierRule(
    @Param('stockItemId', ParseUUIDPipe) stockItemId: string,
    @Param('identifierTypeId', ParseUUIDPipe) identifierTypeId: string,
  ) {
    return {
      success: true,
      message: 'Stock item identifier rule removed successfully',
      data: await this.inventoryAdminService.removeStockItemIdentifierRule(
        stockItemId,
        identifierTypeId,
      ),
    };
  }

  @Get('measurement-groups')
  async listMeasurementGroups() {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.listMeasurementGroups(),
    };
  }

  @Post('measurement-groups')
  async createMeasurementGroup(@Body() dto: MeasurementGroupDto) {
    return {
      success: true,
      message: 'Measurement group created successfully',
      data: await this.inventoryAdminService.createMeasurementGroup(dto),
    };
  }

  @Patch('measurement-groups/:id')
  async updateMeasurementGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeasurementGroupDto,
  ) {
    return {
      success: true,
      message: 'Measurement group updated successfully',
      data: await this.inventoryAdminService.updateMeasurementGroup(id, dto),
    };
  }

  @Get('units')
  async listUnits() {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.listUnits(),
    };
  }

  @Post('units')
  async createUnit(@Body() dto: UnitDto) {
    return {
      success: true,
      message: 'Unit created successfully',
      data: await this.inventoryAdminService.createUnit(dto),
    };
  }

  @Patch('units/:id')
  async updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return {
      success: true,
      message: 'Unit updated successfully',
      data: await this.inventoryAdminService.updateUnit(id, dto),
    };
  }

  @Post('stock-item-units')
  async assignStockItemUnit(@Body() dto: AssignStockItemUnitDto) {
    return {
      success: true,
      message: 'Stock item unit assigned successfully',
      data: await this.inventoryAdminService.assignStockItemUnit(dto),
    };
  }

  @Get('stock-items/:stockItemId/units')
  async listStockItemUnits(
    @Param('stockItemId', ParseUUIDPipe) stockItemId: string,
  ) {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.listStockItemUnits(stockItemId),
    };
  }

  @Post('stock-item-conversions')
  async addStockItemConversion(@Body() dto: StockItemConversionDto) {
    return {
      success: true,
      message: 'Stock item conversion saved successfully',
      data: await this.inventoryAdminService.addStockItemConversion(dto),
    };
  }

  @Get('stock-items/:stockItemId/conversions')
  async listStockItemConversions(
    @Param('stockItemId', ParseUUIDPipe) stockItemId: string,
  ) {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.listStockItemConversions(stockItemId),
    };
  }

  @Get('barcodes')
  async listBarcodes(
    @Query('ownerType') ownerType?: BarcodeOwnerType,
    @Query('productId') productId?: string,
    @Query('stockItemId') stockItemId?: string,
    @Query('q') q?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.listBarcodes({
        ownerType,
        productId,
        stockItemId,
        q,
        activeOnly: activeOnly === 'true',
      }),
    };
  }

  @Post('barcodes')
  async registerBarcode(@Body() dto: BarcodeDto) {
    return {
      success: true,
      message: 'Barcode registered successfully',
      data: await this.inventoryAdminService.registerBarcode(dto),
    };
  }

  @Post('barcodes/generate')
  async generateBarcode(@Body() dto: GenerateBarcodeDto) {
    return {
      success: true,
      message: 'Barcode generated successfully',
      data: await this.inventoryAdminService.generateBarcode(dto),
    };
  }

  @Get('barcodes/lookup')
  async lookupBarcode(@Query('code') code: string) {
    return {
      success: true,
      message: 'Success',
      data: await this.inventoryAdminService.lookupBarcode(code),
    };
  }

  @Post('barcodes/:id/primary')
  async setPrimaryBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Primary barcode updated successfully',
      data: await this.inventoryAdminService.setPrimaryBarcode(id),
    };
  }

  @Post('barcodes/:id/deactivate')
  async deactivateBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Barcode deactivated successfully',
      data: await this.inventoryAdminService.deactivateBarcode(id),
    };
  }

  @Post('barcodes/:id/activate')
  async activateBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Barcode activated successfully',
      data: await this.inventoryAdminService.activateBarcode(id),
    };
  }

  @Post('barcodes/:id/replace')
  async replaceBarcode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceBarcodeDto,
  ) {
    return {
      success: true,
      message: 'Barcode replaced successfully',
      data: await this.inventoryAdminService.replaceBarcode(id, dto),
    };
  }
}
