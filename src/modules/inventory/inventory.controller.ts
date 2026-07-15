import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Request } from 'express';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { InventoryService } from './inventory.service';
import { BatchService } from '../inventory-batch/batch.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & { user?: AuthenticatedUser };

class StockAdjustmentDto {
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

  @ApiProperty()
  @IsNumber()
  quantityDelta!: number;

  @ApiProperty()
  @IsString()
  referenceId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  batchCode?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ type: () => [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serialNumbers?: string[];

  @ApiPropertyOptional({ type: () => [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assetIds?: string[];
}

class InventoryProductQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockItemId?: string;
}

class InventoryAvailabilityQueryDto {
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
}

class InventoryBatchQueryDto extends InventoryProductQueryDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresBefore?: string;
}

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Warehouse Staff')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly prisma: PrismaService,
    private readonly batchService: BatchService,
  ) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  findAll() {
    return this.prisma.inventoryItem.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('products/:productId/fifo')
  async findFifoBatches(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('stockItemId') stockItemId?: string,
  ) {
    const data = await this.prisma.$transaction((transaction) =>
      this.batchService.findFifoBatches(productId, transaction, stockItemId),
    );
    return { success: true, message: 'Success', data };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('products/:productId')
  findProductInventory(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('stockItemId') stockItemId?: string,
  ) {
    return this.inventoryService.getInventorySummary({ productId, stockItemId });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('availability')
  getAvailability(@Query() query: InventoryAvailabilityQueryDto) {
    return this.inventoryService.getAvailability(query);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('movements')
  findMovements(@Query() query: InventoryProductQueryDto) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        productId: query.productId,
        stockItemId: query.stockItemId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('batches')
  findBatches(@Query() query: InventoryBatchQueryDto) {
    return this.prisma.inventoryBatch.findMany({
      where: {
        productId: query.productId,
        stockItemId: query.stockItemId,
        expiryDate: query.expiresBefore
          ? { lte: new Date(query.expiresBefore) }
          : undefined,
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('serials')
  findSerials(@Query() query: InventoryProductQueryDto) {
    return this.prisma.inventorySerial.findMany({
      where: {
        productId: query.productId,
        stockItemId: query.stockItemId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':productId')
  findProductInventoryByContract(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('stockItemId') stockItemId?: string,
  ) {
    return this.findProductInventory(productId, stockItemId);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('adjustments')
  adjustStock(@Body() dto: StockAdjustmentDto, @Req() req: RequestWithUser) {
    return this.inventoryService.adjustStock(dto, {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
