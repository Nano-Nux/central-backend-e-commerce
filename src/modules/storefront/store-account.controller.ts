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
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  CreateStoreCustomerAddressDto,
  StoreAddressListResponseDto,
  StoreAddressResponseDto,
  StoreDeleteResponseDto,
  StoreMeResponseDto,
  StoreOrderDetailResponseDto,
  StoreOrderListQueryDto,
  StoreOrderListResponseDto,
  UpdateStoreCustomerAddressDto,
  UpdateStoreMeDto,
} from './dto/store-account.dto';
import { StoreAccountService } from './store-account.service';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

@ApiTags('Store Account')
@ApiBearerAuth()
@Controller('store/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Customer')
export class StoreAccountController {
  constructor(private readonly storeAccountService: StoreAccountService) {}

  @ApiOkResponse({ type: StoreMeResponseDto })
  @Get()
  async getMe(@Req() req: RequestWithUser) {
    return {
      success: true,
      data: await this.storeAccountService.getMe(this.userId(req)),
    };
  }

  @ApiOkResponse({ type: StoreMeResponseDto })
  @Patch()
  async updateMe(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateStoreMeDto,
  ) {
    return {
      success: true,
      data: await this.storeAccountService.updateMe(this.userId(req), dto),
    };
  }

  @ApiOkResponse({ type: StoreAddressListResponseDto })
  @Get('addresses')
  async listAddresses(@Req() req: RequestWithUser) {
    return {
      success: true,
      data: await this.storeAccountService.listAddresses(this.userId(req)),
    };
  }

  @ApiCreatedResponse({ type: StoreAddressResponseDto })
  @Post('addresses')
  async createAddress(
    @Req() req: RequestWithUser,
    @Body() dto: CreateStoreCustomerAddressDto,
  ) {
    return {
      success: true,
      data: await this.storeAccountService.createAddress(this.userId(req), dto),
    };
  }

  @ApiOkResponse({ type: StoreAddressResponseDto })
  @Patch('addresses/:id')
  async updateAddress(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreCustomerAddressDto,
  ) {
    return {
      success: true,
      data: await this.storeAccountService.updateAddress(this.userId(req), id, dto),
    };
  }

  @ApiOkResponse({ type: StoreAddressResponseDto })
  @Post('addresses/:id/default')
  async setDefaultAddress(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      success: true,
      data: await this.storeAccountService.setDefaultAddress(this.userId(req), id),
    };
  }

  @ApiOkResponse({ type: StoreDeleteResponseDto })
  @Delete('addresses/:id')
  async deleteAddress(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      success: true,
      data: await this.storeAccountService.deleteAddress(this.userId(req), id),
    };
  }

  @ApiOkResponse({ type: StoreOrderListResponseDto })
  @Get('orders')
  async listOrders(
    @Req() req: RequestWithUser,
    @Query() query: StoreOrderListQueryDto,
  ) {
    const result = await this.storeAccountService.listOrders(this.userId(req), query);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOkResponse({ type: StoreOrderDetailResponseDto })
  @Get('orders/:id')
  async getOrder(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      success: true,
      data: await this.storeAccountService.getOrderDetail(this.userId(req), id),
    };
  }

  private userId(req: RequestWithUser) {
    if (!req.user?.id) {
      throw new Error('Authenticated user is missing');
    }

    return req.user.id;
  }
}
