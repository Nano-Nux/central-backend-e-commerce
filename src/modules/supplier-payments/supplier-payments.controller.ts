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
import { CreateSupplierPaymentDto } from '../purchase/dto/create-supplier-payment.dto';
import { SupplierPaymentsService } from './supplier-payments.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@ApiTags('Purchase')
@Controller('supplier-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Accountant')
export class SupplierPaymentsController {
  constructor(private readonly service: SupplierPaymentsService) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Accountant' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(
    @Body() dto: CreateSupplierPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.service.create(dto, {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Supplier payment created successfully',
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
