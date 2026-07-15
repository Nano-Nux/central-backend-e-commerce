import {
  Body,
  Controller,
  Get,
  Patch,
  Delete,
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
import { IsOptional } from 'class-validator';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SortOrder } from '../inventory/inventory-read.dto';
import { PurchaseReadService } from '../purchase/purchase-read.service';
import { CreateSupplierDto } from '../purchase/dto/create-supplier.dto';
import { UpdateSupplierDto } from '../purchase/dto/update-supplier.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { SuppliersService } from './suppliers.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

class PurchaseHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SortOrder })
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

@ApiTags('Purchase')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly purchaseReadService: PurchaseReadService,
  ) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(@Body() dto: CreateSupplierDto, @Req() req: RequestWithUser) {
    const supplier = await this.suppliersService.create(dto, {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Supplier created successfully',
      data: supplier,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll() {
    const suppliers = await this.suppliersService.findAll();

    return {
      success: true,
      message: 'Success',
      data: suppliers,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const supplier = await this.suppliersService.findOne(id);

    return {
      success: true,
      message: 'Success',
      data: supplier,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @Req() req: RequestWithUser,
  ) {
    return this.suppliersService.update(id, dto, {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.suppliersService.remove(id, {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id/purchase-history')
  async purchaseHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PurchaseHistoryQueryDto,
  ) {
    const result = await this.purchaseReadService.supplierPurchaseHistory(
      id,
      query,
    );

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }
}
