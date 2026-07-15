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
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SortOrder } from '../inventory/inventory-read.dto';
import { PurchaseReadService } from '../purchase/purchase-read.service';
import { CreateGoodsReceiptDto } from '../purchase/dto/create-goods-receipt.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { GoodsReceiptsService } from './goods-receipts.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & { user?: AuthenticatedUser };

class GoodsReceiptListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

@ApiTags('Purchase')
@Controller('goods-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Warehouse Staff')
export class GoodsReceiptsController {
  constructor(
    private readonly goodsReceiptsService: GoodsReceiptsService,
    private readonly purchaseReadService: PurchaseReadService,
  ) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(
    @Body() dto: CreateGoodsReceiptDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.goodsReceiptsService.create(dto, {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Goods receipt created successfully',
      data,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll(@Query() query: GoodsReceiptListQueryDto) {
    const result = await this.purchaseReadService.listGoodsReceipts(query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Warehouse Staff' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.purchaseReadService.getGoodsReceipt(id);

    return { success: true, message: 'Success', data };
  }
}
