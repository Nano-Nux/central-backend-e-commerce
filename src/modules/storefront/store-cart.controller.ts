import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { IsUUID } from 'class-validator';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  MergeStoreCartDto,
  StoreCartItemMutationDto,
  StoreCartResponseDto,
  UpdateStoreCartItemDto,
} from './dto/store-cart.dto';
import { StoreCartService } from './store-cart.service';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

class ContractUpdateStoreCartDto extends UpdateStoreCartItemDto {
  @IsUUID()
  itemId!: string;
}

@ApiTags('Store Cart')
@ApiBearerAuth()
@Controller('store/cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Customer')
export class StoreCartController {
  constructor(private readonly storeCartService: StoreCartService) {}

  @ApiOkResponse({ type: StoreCartResponseDto })
  @Get()
  async getCart(@Req() req: RequestWithUser) {
    return {
      success: true,
      data: await this.storeCartService.getCart(this.userId(req)),
    };
  }

  @ApiCreatedResponse({ type: StoreCartResponseDto })
  @Post()
  async addItemAtContractRoute(
    @Req() req: RequestWithUser,
    @Body() dto: StoreCartItemMutationDto,
  ) {
    return {
      success: true,
      data: await this.storeCartService.addItem(this.userId(req), dto),
    };
  }

  @ApiCreatedResponse({ type: StoreCartResponseDto })
  @Post('items')
  async addItem(
    @Req() req: RequestWithUser,
    @Body() dto: StoreCartItemMutationDto,
  ) {
    return {
      success: true,
      data: await this.storeCartService.addItem(this.userId(req), dto),
    };
  }

  @ApiOkResponse({ type: StoreCartResponseDto })
  @Patch()
  async updateItemAtContractRoute(
    @Req() req: RequestWithUser,
    @Body() dto: ContractUpdateStoreCartDto,
  ) {
    return {
      success: true,
      data: await this.storeCartService.updateItem(this.userId(req), dto.itemId, dto),
    };
  }

  @ApiOkResponse({ type: StoreCartResponseDto })
  @Patch('items/:itemId')
  async updateItem(
    @Req() req: RequestWithUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateStoreCartItemDto,
  ) {
    return {
      success: true,
      data: await this.storeCartService.updateItem(this.userId(req), itemId, dto),
    };
  }

  @ApiOkResponse({ type: StoreCartResponseDto })
  @Delete('items/:itemId')
  async removeItem(
    @Req() req: RequestWithUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return {
      success: true,
      data: await this.storeCartService.removeItem(this.userId(req), itemId),
    };
  }

  @ApiOkResponse({ type: StoreCartResponseDto })
  @Delete()
  async clearCart(@Req() req: RequestWithUser) {
    return {
      success: true,
      data: await this.storeCartService.clearCart(this.userId(req)),
    };
  }

  @ApiOkResponse({ type: StoreCartResponseDto })
  @Post('merge')
  async mergeCart(
    @Req() req: RequestWithUser,
    @Body() dto: MergeStoreCartDto,
  ) {
    return {
      success: true,
      data: await this.storeCartService.mergeCart(this.userId(req), dto),
    };
  }

  private userId(req: RequestWithUser) {
    if (!req.user?.id) {
      throw new Error('Authenticated user is missing');
    }

    return req.user.id;
  }
}
