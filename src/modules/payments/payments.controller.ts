import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { RecordPaymentDto } from '../shared/dto/record-payment.dto';
import { RefundPaymentDto } from '../shared/dto/refund-payment.dto';
import { PaymentsService } from './payments.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import {
  MerchantPaymentConfigurationListResponseDto,
  MerchantPaymentConfigurationResponseDto,
  PaymentProofListResponseDto,
  PaymentProofResponseDto,
  RejectPaymentProofDto,
  UpsertMerchantPaymentConfigurationDto,
} from '../storefront/dto/store-payments.dto';
import { MerchantPaymentConfigurationsService } from './merchant-payment-configurations.service';
import { PaymentProofsService } from './payment-proofs.service';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Sales Agent', 'Accountant')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly merchantPaymentConfigurationsService: MerchantPaymentConfigurationsService,
    private readonly paymentProofsService: PaymentProofsService,
  ) {}

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Sales Agent, Accountant',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async recordPayment(
    @Body() recordPaymentDto: RecordPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    const payment = await this.paymentsService.recordPayment(
      recordPaymentDto,
      this.auditContext(req),
    );

    return {
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Sales Agent, Accountant',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    const result = await this.paymentsService.findAll(query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Sales Agent, Accountant',
  })
  @ApiOkResponse({ description: 'Success', type: PaymentProofListResponseDto })
  @Get('proofs')
  async listPaymentProofs(@Query() query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return {
      success: true,
      data: await this.paymentProofsService.listProofs(page, limit),
    };
  }

  @ApiOkResponse({ description: 'Success', type: PaymentProofResponseDto })
  @Roles('Admin')
  @Get('proofs/:id')
  async findPaymentProof(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.paymentProofsService.getProofById(id),
    };
  }

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: PaymentProofResponseDto,
  })
  @Roles('Admin')
  @Post('proofs/:id/approve')
  async approvePaymentProof(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return {
      success: true,
      message: 'Payment proof approved successfully',
      data: await this.paymentProofsService.approveProof(
        id,
        this.auditContext(req),
      ),
    };
  }

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: PaymentProofResponseDto,
  })
  @Roles('Admin')
  @Post('proofs/:id/reject')
  async rejectPaymentProof(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPaymentProofDto,
    @Req() req: RequestWithUser,
  ) {
    return {
      success: true,
      message: 'Payment proof rejected successfully',
      data: await this.paymentProofsService.rejectProof(
        id,
        dto.reason,
        this.auditContext(req),
      ),
    };
  }

  @ApiOkResponse({
    description: 'Success',
    type: MerchantPaymentConfigurationListResponseDto,
  })
  @Roles('Admin')
  @Get('merchant-configurations')
  async listMerchantConfigurations() {
    return {
      success: true,
      data: await this.merchantPaymentConfigurationsService.list(),
    };
  }

  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: MerchantPaymentConfigurationResponseDto,
  })
  @Roles('Admin')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Post('merchant-configurations')
  async createMerchantConfiguration(
    @Body() dto: UpsertMerchantPaymentConfigurationDto,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      size: number;
      mimetype: string;
    },
  ) {
    return {
      success: true,
      data: await this.merchantPaymentConfigurationsService.create({
        ...dto,
        file,
      }),
    };
  }

  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({
    description: 'Success',
    type: MerchantPaymentConfigurationResponseDto,
  })
  @Roles('Admin')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Patch('merchant-configurations/:id')
  async updateMerchantConfiguration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertMerchantPaymentConfigurationDto,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      size: number;
      mimetype: string;
    },
  ) {
    return {
      success: true,
      data: await this.merchantPaymentConfigurationsService.update(id, {
        ...dto,
        file,
      }),
    };
  }

  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.paymentsService.findOne(id);

    return {
      success: true,
      message: 'Success',
      data: payment,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Sales Agent, Accountant',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(':id/refund')
  async refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() refundPaymentDto: RefundPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    const payment = await this.paymentsService.refundPayment(
      id,
      refundPaymentDto.reason,
      this.auditContext(req),
    );

    return {
      success: true,
      message: 'Payment refunded successfully',
      data: payment,
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
