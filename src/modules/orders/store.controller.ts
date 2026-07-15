import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { StoreCheckoutDto } from '../shared/dto/store-checkout.dto';
import { StoreCheckoutResponseDto } from '../storefront/dto/store-checkout.dto';
import { StoreCheckoutService } from './store-checkout.service';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(private readonly storeCheckoutService: StoreCheckoutService) {}

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: StoreCheckoutResponseDto,
  })
  @Post('checkout')
  async checkout(@Body() dto: StoreCheckoutDto, @Req() req: Request) {
    const data = await this.storeCheckoutService.checkout(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Checkout created successfully',
      data,
    };
  }

  @ApiBearerAuth()
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: StoreCheckoutResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  @Post('checkout/authenticated')
  async authenticatedCheckout(
    @Body() dto: StoreCheckoutDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.storeCheckoutService.checkout(dto, {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Checkout created successfully',
      data,
    };
  }
}
