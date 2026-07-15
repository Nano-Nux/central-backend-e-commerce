import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateSupplierInvoiceDto } from '../purchase/dto/create-supplier-invoice.dto';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@ApiTags('Purchase')
@Controller('supplier-invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Accountant')
export class SupplierInvoicesController {
  constructor(private readonly service: SupplierInvoicesService) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(
    @Body() dto: CreateSupplierInvoiceDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.service.create(dto, {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Supplier invoice created successfully',
      data,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll() {
    const data = await this.service.findAll();

    return { success: true, message: 'Success', data };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.findOne(id);
    return { success: true, message: 'Success', data };
  }
}
