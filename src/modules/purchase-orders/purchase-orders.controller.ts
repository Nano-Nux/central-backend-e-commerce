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
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Request } from 'express';

import { PurchaseOrderStatus } from '../../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreatePurchaseOrderDto } from '../purchase/dto/create-purchase-order.dto';
import { PurchaseReadService } from '../purchase/purchase-read.service';
import { SortOrder } from '../inventory/inventory-read.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & { user?: AuthenticatedUser };

class PurchaseOrderListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsEnum(PurchaseOrderStatus)
  @IsOptional()
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

@ApiTags('Purchase')
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Warehouse Staff', 'Accountant')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly purchaseReadService: PurchaseReadService,
  ) {}

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Warehouse Staff, Accountant',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.purchaseOrdersService.create(
      dto,
      this.context(req),
    );

    return {
      success: true,
      message: 'Purchase order created successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Warehouse Staff, Accountant',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll(@Query() query: PurchaseOrderListQueryDto) {
    const result = await this.purchaseReadService.listPurchaseOrders(query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Warehouse Staff, Accountant',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.purchaseReadService.getPurchaseOrder(id);

    return { success: true, message: 'Success', data };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Warehouse Staff, Accountant',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post([':id/approve', ':id/submit'])
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.purchaseOrdersService.approve(
      id,
      this.context(req),
    );

    return {
      success: true,
      message: 'Purchase order approved successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Warehouse Staff, Accountant',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.purchaseOrdersService.cancel(id, this.context(req));

    return {
      success: true,
      message: 'Purchase order cancelled successfully',
      data,
    };
  }

  private context(req: RequestWithUser) {
    return {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
