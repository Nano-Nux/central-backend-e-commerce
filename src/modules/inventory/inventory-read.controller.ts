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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  AssetListQueryDto,
  AssetSearchQueryDto,
  BarcodeListQueryDto,
  BatchListQueryDto,
  ConversionListQueryDto,
  CreateTransformationDto,
  InventoryReportQueryDto,
  MovementListQueryDto,
  StockItemListQueryDto,
  TransformationListQueryDto,
  UnitListQueryDto,
  UpdateAssetDto,
  UpdateBarcodeDto,
} from './inventory-read.dto';
import { InventoryReadService } from './inventory-read.service';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Warehouse Staff', 'Sales Agent', 'Accountant')
export class InventoryReadController {
  constructor(private readonly inventoryReadService: InventoryReadService) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff, Sales Agent, Accountant' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/stock-items')
  async listStockItems(@Query() query: StockItemListQueryDto) {
    const result = await this.inventoryReadService.listStockItems(query);

    return this.paginated(result);
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/stock-items/:id')
  async getStockItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getStockItem(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/stock-items/:id/summary')
  async getStockItemSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getStockItemSummary(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/stock-items/:id/movements')
  async getStockItemMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MovementListQueryDto,
  ) {
    return this.paginated(
      await this.inventoryReadService.listStockItemMovements(id, query),
    );
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/stock-items/:id/batches')
  async getStockItemBatches(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: BatchListQueryDto,
  ) {
    return this.paginated(
      await this.inventoryReadService.listStockItemBatches(id, query),
    );
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/stock-items/:id/assets')
  async getStockItemAssets(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AssetListQueryDto,
  ) {
    return this.paginated(
      await this.inventoryReadService.listStockItemAssets(id, query),
    );
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/stock-items/:id/reservations')
  async getStockItemReservations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MovementListQueryDto,
  ) {
    return this.paginated(
      await this.inventoryReadService.listStockItemReservations(id, query),
    );
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/barcodes')
  async listBarcodes(@Query() query: BarcodeListQueryDto) {
    return this.paginated(await this.inventoryReadService.listBarcodes(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/barcodes/:id')
  async getBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getBarcode(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/barcodes/:id/history')
  async getBarcodeHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InventoryReportQueryDto,
  ) {
    return this.paginated(
      await this.inventoryReadService.getBarcodeHistory(id, query),
    );
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Patch('inventory/barcodes/:id')
  async updateBarcode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBarcodeDto,
  ) {
    return this.success(await this.inventoryReadService.updateBarcode(id, dto));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Delete('inventory/barcodes/:id')
  async deleteBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.deleteBarcode(id));
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('inventory/barcodes/:id/activate')
  async activateBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.activateBarcode(id));
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('inventory/barcodes/:id/deactivate')
  async deactivateBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.deactivateBarcode(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/assets/search')
  async searchAssets(@Query() query: AssetSearchQueryDto) {
    return this.paginated(await this.inventoryReadService.searchAssets(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/assets/by-identifier/:value')
  async getAssetByIdentifier(@Param('value') value: string) {
    return this.success(await this.inventoryReadService.getAssetByIdentifier(value));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/assets')
  async listAssets(@Query() query: AssetListQueryDto) {
    return this.paginated(await this.inventoryReadService.listAssets(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/assets/:id')
  async getAsset(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getAsset(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/assets/:id/history')
  async getAssetHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getAssetHistory(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Patch('inventory/assets/:id')
  async updateAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.success(await this.inventoryReadService.updateAsset(id, dto));
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('inventory/assets/:id/retire')
  async retireAsset(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.retireAsset(id));
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('inventory/assets/:id/reactivate')
  async reactivateAsset(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.reactivateAsset(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/units')
  async listUnits(@Query() query: UnitListQueryDto) {
    return this.paginated(await this.inventoryReadService.listUnits(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/units/:id')
  async getUnit(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getUnit(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/units/:id/history')
  async getUnitHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InventoryReportQueryDto,
  ) {
    return this.paginated(await this.inventoryReadService.getUnitHistory(id, query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/conversions')
  async listConversions(@Query() query: ConversionListQueryDto) {
    return this.paginated(await this.inventoryReadService.listConversions(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/conversions/:id')
  async getConversion(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getConversion(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/conversions/:id/history')
  async getConversionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InventoryReportQueryDto,
  ) {
    return this.paginated(
      await this.inventoryReadService.getConversionHistory(id, query),
    );
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/batches/expired')
  async listExpiredBatches(@Query() query: BatchListQueryDto) {
    return this.paginated(await this.inventoryReadService.listExpiredBatches(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/batches/expiring')
  async listExpiringBatches(@Query() query: InventoryReportQueryDto) {
    return this.paginated(await this.inventoryReadService.listExpiringBatches(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/batches')
  async listBatches(@Query() query: BatchListQueryDto) {
    return this.paginated(await this.inventoryReadService.listBatches(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/batches/:id')
  async getBatch(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getBatch(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/batches/:id/movements')
  async getBatchMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MovementListQueryDto,
  ) {
    return this.paginated(await this.inventoryReadService.getBatchMovements(id, query));
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('inventory/transformations')
  async createTransformation(
    @Body() dto: CreateTransformationDto,
    @Req() req: RequestWithUser,
  ) {
    return this.success(
      await this.inventoryReadService.createTransformation(dto, req.user?.id),
      'Inventory transformation created successfully',
    );
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/transformations')
  async listTransformations(@Query() query: TransformationListQueryDto) {
    return this.paginated(await this.inventoryReadService.listTransformations(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/transformations/:id')
  async getTransformation(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(await this.inventoryReadService.getTransformation(id));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('inventory/transformations/:id/history')
  async getTransformationHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InventoryReportQueryDto,
  ) {
    return this.paginated(
      await this.inventoryReadService.getTransformationHistory(id, query),
    );
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('inventory/transformations/:id/execute')
  async executeTransformation(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(
      await this.inventoryReadService.executeTransformation(id),
      'Inventory transformation executed successfully',
    );
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('inventory/transformations/:id/cancel')
  async cancelTransformation(@Param('id', ParseUUIDPipe) id: string) {
    return this.success(
      await this.inventoryReadService.cancelTransformation(id),
      'Inventory transformation cancelled successfully',
    );
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('reports/inventory-summary')
  async inventorySummaryReport(@Query() query: InventoryReportQueryDto) {
    return this.paginated(await this.inventoryReadService.inventorySummaryReport(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('reports/inventory-movements')
  async inventoryMovementsReport(@Query() query: InventoryReportQueryDto) {
    return this.paginated(await this.inventoryReadService.inventoryMovementsReport(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('reports/inventory-valuation')
  async inventoryValuationReport(@Query() query: InventoryReportQueryDto) {
    return this.paginated(await this.inventoryReadService.inventoryValuationReport(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('reports/expiring-stock')
  async expiringStockReport(@Query() query: InventoryReportQueryDto) {
    return this.paginated(await this.inventoryReadService.expiringStockReport(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('reports/assets')
  async assetsReport(@Query() query: InventoryReportQueryDto) {
    return this.paginated(await this.inventoryReadService.assetsReport(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('reports/purchasing')
  async purchasingReport(@Query() query: InventoryReportQueryDto) {
    return this.paginated(await this.inventoryReadService.purchasingReport(query));
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('reports/pos')
  async posReport(@Query() query: InventoryReportQueryDto) {
    return this.paginated(await this.inventoryReadService.posReport(query));
  }

  private success(data: unknown, message = 'Success') {
    return {
      success: true,
      message,
      data,
    };
  }

  private paginated(result: { data: unknown; pagination: unknown }) {
    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }
}
