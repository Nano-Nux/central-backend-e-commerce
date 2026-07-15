import {
  Body,
  Controller,
  Get,
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
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Request } from 'express';

import { POSSessionStatus } from '../../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SortOrder } from '../inventory/inventory-read.dto';
import { ClosePOSSessionDto } from '../shared/dto/close-pos-session.dto';
import { CreatePOSSaleDto } from '../shared/dto/create-pos-sale.dto';
import { OpenPOSSessionDto } from '../shared/dto/open-pos-session.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { POSService } from './pos.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & {
  user: AuthenticatedUser;
};

class POSSessionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: POSSessionStatus })
  @IsEnum(POSSessionStatus)
  @IsOptional()
  status?: POSSessionStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

class POSSaleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

@ApiTags('POS')
@Controller('pos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Sales Agent')
export class POSController {
  constructor(private readonly posService: POSService) {}

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('sessions/open')
  async openSession(
    @Body() openPOSSessionDto: OpenPOSSessionDto,
    @Req() req: RequestWithUser,
  ) {
    const session = await this.posService.openSession(
      req.user.id,
      openPOSSessionDto,
      this.auditContext(req),
    );

    return {
      success: true,
      message: 'POS session opened successfully',
      data: session,
    };
  }

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('sessions/close')
  async closeSession(
    @Body() closePOSSessionDto: ClosePOSSessionDto,
    @Req() req: RequestWithUser,
  ) {
    const session = await this.posService.closeSession(
      closePOSSessionDto,
      this.auditContext(req),
    );

    return {
      success: true,
      message: 'POS session closed successfully',
      data: session,
    };
  }

  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('sessions')
  async findSessions(@Query() query: POSSessionListQueryDto) {
    const sessions = await this.posService.listSessions(query);

    return {
      success: true,
      message: 'Success',
      data: sessions.data,
      pagination: sessions.pagination,
    };
  }

  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('sessions/:id')
  async findSession(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Success',
      data: await this.posService.getSession(id),
    };
  }

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('sales')
  async createSale(
    @Body() createPOSSaleDto: CreatePOSSaleDto,
    @Req() req: RequestWithUser,
  ) {
    const sale = await this.posService.createSale(
      createPOSSaleDto,
      this.auditContext(req),
    );

    return {
      success: true,
      message: 'POS sale created successfully',
      data: sale,
    };
  }

  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('sales')
  async listSales(@Query() query: POSSaleListQueryDto) {
    const result = await this.posService.listSales(query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('sales/:id')
  async getSale(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Success',
      data: await this.posService.getSale(id),
    };
  }

  private auditContext(req: RequestWithUser) {
    return {
      actorId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
