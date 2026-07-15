import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { GuestOrderAccessGuard } from './guest-order-access.guard';
import {
  GuestOrderClaimDto,
  GuestOrderClaimResponseDto,
  GuestOrderDetailResponseDto,
  GuestOrderListResponseDto,
  GuestOrderLookupRequestDto,
  GuestOrderLookupRequestResponseDto,
  GuestOrderVerifyDto,
  GuestOrderVerifyResponseDto,
} from './dto/store-guest-orders.dto';
import { StoreGuestOrdersService } from './store-guest-orders.service';

type GuestRequest = Request & {
  guestEmail?: string;
  user?: AuthenticatedUser;
};

@ApiTags('Store Guest Orders')
@Controller('store/guest-orders')
export class StoreGuestOrdersController {
  constructor(
    private readonly storeGuestOrdersService: StoreGuestOrdersService,
  ) {}

  @ApiCreatedResponse({ type: GuestOrderLookupRequestResponseDto })
  @Post('lookup-request')
  async requestLookup(@Body() dto: GuestOrderLookupRequestDto) {
    await this.storeGuestOrdersService.requestLookup(dto.email, dto.orderId);

    return {
      success: true,
      message: 'Verification email sent if eligible orders exist.',
    };
  }

  @ApiCreatedResponse({ type: GuestOrderVerifyResponseDto })
  @Post('verify')
  async verify(@Body() dto: GuestOrderVerifyDto) {
    return {
      success: true,
      data: await this.storeGuestOrdersService.verifyLookup(
        dto.email,
        dto.code,
        dto.verificationToken,
      ),
    };
  }

  @ApiHeader({
    name: 'x-guest-access-token',
    required: true,
  })
  @ApiOkResponse({ type: GuestOrderListResponseDto })
  @UseGuards(GuestOrderAccessGuard)
  @Get()
  async listOrders(@Req() req: GuestRequest) {
    return {
      success: true,
      data: await this.storeGuestOrdersService.listOrders(req.guestEmail ?? ''),
    };
  }

  @ApiHeader({
    name: 'x-guest-access-token',
    required: true,
  })
  @ApiOkResponse({ type: GuestOrderDetailResponseDto })
  @UseGuards(GuestOrderAccessGuard)
  @Get(':id')
  async getOrder(
    @Req() req: GuestRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      success: true,
      data: await this.storeGuestOrdersService.getOrder(
        req.guestEmail ?? '',
        id,
      ),
    };
  }

  @ApiHeader({ name: 'x-guest-access-token', required: true })
  @ApiCreatedResponse({ description: 'Invoice email queued' })
  @UseGuards(GuestOrderAccessGuard)
  @Post(':id/invoice')
  async sendInvoice(
    @Req() req: GuestRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      success: true,
      data: await this.storeGuestOrdersService.queueInvoice(
        req.guestEmail ?? '',
        id,
      ),
    };
  }

  @ApiBearerAuth()
  @ApiOkResponse({ type: GuestOrderClaimResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post('claim')
  async claimOrders(
    @Req() req: GuestRequest,
    @Body() dto: GuestOrderClaimDto,
  ) {
    return {
      success: true,
      data: await this.storeGuestOrdersService.claimOrders(
        req.user as AuthenticatedUser,
        dto.accessToken ?? dto.guestAccessToken ?? '',
      ),
    };
  }
}
