import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ConfirmLinePaySessionDto,
  CreateLinePaySessionDto,
  LinePayCallbackDto,
  LinePaySessionResponseDto,
  StorePaymentMethodListResponseDto,
  PaymentProofResponseDto,
  UploadPaymentProofDto,
} from './dto/store-payments.dto';
import { GuestOrderAccessGuard } from './guest-order-access.guard';
import { StorePaymentsService } from './store-payments.service';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

type GuestRequest = Request & {
  guestEmail?: string;
};

@ApiTags('Store Payments')
@Controller('store')
export class StorePaymentsController {
  constructor(private readonly storePaymentsService: StorePaymentsService) {}

  @ApiOkResponse({ type: StorePaymentMethodListResponseDto })
  @Get('payment-methods')
  async listPaymentMethods() {
    return {
      success: true,
      data: await this.storePaymentsService.listEnabledPaymentMethods(),
    };
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: PaymentProofResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Customer')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Post('me/orders/:id/payment-proofs')
  async uploadCustomerPaymentProof(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: UploadPaymentProofDto,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      size: number;
      mimetype: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      success: true,
      data: await this.storePaymentsService.uploadProofForCustomer(
        req.user!.id,
        orderId,
        {
          paymentId: dto.paymentId,
          file,
        },
      ),
    };
  }

  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: PaymentProofResponseDto })
  @ApiHeader({
    name: 'x-guest-access-token',
    required: true,
    description: 'Guest access token issued by guest order verification or checkout',
  })
  @UseGuards(GuestOrderAccessGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Post('guest-orders/:id/payment-proofs')
  async uploadGuestPaymentProof(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: UploadPaymentProofDto,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      size: number;
      mimetype: string;
    },
    @Req() req: GuestRequest,
  ) {
    return {
      success: true,
      data: await this.storePaymentsService.uploadProofForGuest(
        req.guestEmail!,
        orderId,
        {
          paymentId: dto.paymentId,
          file,
        },
      ),
    };
  }

  @ApiBearerAuth()
  @ApiCreatedResponse({ type: LinePaySessionResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Customer')
  @Post('me/orders/:id/line-pay/session')
  async createCustomerLinePaySession(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateLinePaySessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      success: true,
      data: await this.storePaymentsService.createLinePaySessionForCustomer(
        req.user!.id,
        orderId,
        dto,
      ),
    };
  }

  @ApiCreatedResponse({ type: LinePaySessionResponseDto })
  @ApiHeader({
    name: 'x-guest-access-token',
    required: true,
    description: 'Guest access token issued by guest order verification or checkout',
  })
  @UseGuards(GuestOrderAccessGuard)
  @Post('guest-orders/:id/line-pay/session')
  async createGuestLinePaySession(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateLinePaySessionDto,
    @Req() req: GuestRequest,
  ) {
    return {
      success: true,
      data: await this.storePaymentsService.createLinePaySessionForGuest(
        req.guestEmail!,
        orderId,
        dto,
      ),
    };
  }

  @ApiBearerAuth()
  @ApiOkResponse({ type: LinePaySessionResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Customer')
  @Post('me/orders/:id/line-pay/confirm')
  async confirmCustomerLinePay(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: ConfirmLinePaySessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      success: true,
      data: await this.storePaymentsService.confirmLinePaySessionForCustomer(
        req.user!.id,
        orderId,
        dto.providerSessionId,
        {
          actorId: req.user?.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      ),
    };
  }

  @ApiOkResponse({ type: LinePaySessionResponseDto })
  @ApiHeader({
    name: 'x-guest-access-token',
    required: true,
    description: 'Guest access token issued by guest order verification or checkout',
  })
  @UseGuards(GuestOrderAccessGuard)
  @Post('guest-orders/:id/line-pay/confirm')
  async confirmGuestLinePay(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: ConfirmLinePaySessionDto,
    @Req() req: GuestRequest,
  ) {
    return {
      success: true,
      data: await this.storePaymentsService.confirmLinePaySessionForGuest(
        req.guestEmail!,
        orderId,
        dto.providerSessionId,
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      ),
    };
  }

  @ApiOkResponse({ type: LinePaySessionResponseDto })
  @Get('payments/line-pay/return')
  async linePayReturn(@Query() query: LinePayCallbackDto) {
    return {
      success: true,
      data: await this.storePaymentsService.handleLinePayReturn(query),
    };
  }

  @ApiOkResponse({ type: LinePaySessionResponseDto })
  @Post('payments/line-pay/webhook')
  async linePayWebhook(@Body() dto: LinePayCallbackDto, @Req() req: Request) {
    return {
      success: true,
      data: await this.storePaymentsService.handleLinePayWebhook(dto, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }),
    };
  }
}
