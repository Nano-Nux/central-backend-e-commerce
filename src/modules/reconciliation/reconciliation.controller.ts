import {
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
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Request } from 'express';

import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryReconciliationExceptionStatus } from '../../../generated/prisma/enums';
import { ReconciliationService } from './reconciliation.service';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

type RequestWithUser = Request & { user?: AuthenticatedUser };

class InventoryExceptionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InventoryReconciliationExceptionStatus })
  @IsEnum(InventoryReconciliationExceptionStatus)
  @IsOptional()
  status?: InventoryReconciliationExceptionStatus;
}

@ApiTags('Reconciliation')
@ApiBearerAuth()
@Controller('reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('inventory-exceptions')
  listInventoryExceptions(@Query() query: InventoryExceptionQueryDto) {
    return this.reconciliationService.listInventoryExceptions(query.status, query.page, query.limit);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('inventory-exceptions/:id/resolve')
  resolveInventoryException(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.reconciliationService.resolveInventoryException(id, {
      actorId: req.user?.id,
    });
  }
}
