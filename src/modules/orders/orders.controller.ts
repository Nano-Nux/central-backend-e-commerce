import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
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
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateOrderDto } from '../shared/dto/create-order.dto';
import { OrderListQueryDto } from '../shared/dto/order-list-query.dto';
import { UpdateOrderDto } from '../shared/dto/update-order.dto';
import { OrdersService } from './orders.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Sales Agent')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Sales Agent' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: RequestWithUser,
  ) {
    const order = await this.ordersService.create(
      createOrderDto,
      this.auditContext(req),
    );

    return {
      success: true,
      message: 'Order created successfully',
      data: order,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Sales Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll(@Query() query: OrderListQueryDto) {
    const result = await this.ordersService.findAll(query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Sales Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.findOne(id);

    return {
      success: true,
      message: 'Success',
      data: order,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Sales Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
    @Req() req: RequestWithUser,
  ) {
    return {
      success: true,
      message: 'Order updated successfully',
      data: await this.ordersService.update(id, dto, this.auditContext(req)),
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Sales Agent' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    const order = await this.ordersService.cancel(id, this.auditContext(req));

    return {
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Sales Agent' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(':id/complete')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    const order = await this.ordersService.complete(id, this.auditContext(req));

    return {
      success: true,
      message: 'Order completed successfully',
      data: order,
    };
  }

  private auditContext(req: RequestWithUser) {
    return {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
