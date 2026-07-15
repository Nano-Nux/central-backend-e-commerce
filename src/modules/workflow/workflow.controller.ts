import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { createPaginationMeta, normalizePagination } from '../shared/helpers/pagination.helper';

type RequestWithUser = Request & { user?: AuthenticatedUser };

class TriggerWorkflowDto {
  @ApiProperty()
  @IsString()
  triggerEvent!: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}

class WorkflowQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  triggerEvent?: string;
}

class WorkflowRuleDto {
  @ApiProperty({ type: Object })
  @IsObject()
  conditionJson!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  @IsObject()
  actionJson!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

class CreateWorkflowDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  triggerEvent!: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ type: () => [WorkflowRuleDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkflowRuleDto)
  rules?: WorkflowRuleDto[];
}

class UpdateWorkflowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: () => [WorkflowRuleDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkflowRuleDto)
  rules?: WorkflowRuleDto[];
}

@ApiTags('Workflows')
@Controller('workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class WorkflowController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findWorkflows(@Query() query: WorkflowQueryDto) {
    const pagination = normalizePagination(query.page, query.limit);
    const where = { triggerEvent: query.triggerEvent };
    const [data, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where,
        include: { rules: { orderBy: { orderIndex: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.workflow.count({ where }),
    ]);
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({ description: 'Created successfully', type: ApiSuccessResponseDto })
  @Post()
  createWorkflow(@Body() dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        name: dto.name,
        triggerEvent: dto.triggerEvent,
        isActive: dto.isActive ?? true,
        rules: dto.rules
          ? {
              create: dto.rules.map((rule) => ({
                conditionJson: rule.conditionJson as Prisma.InputJsonValue,
                actionJson: rule.actionJson as Prisma.InputJsonValue,
                orderIndex: rule.orderIndex ?? 0,
              })),
            }
          : undefined,
      },
      include: { rules: true },
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Updated successfully', type: ApiSuccessResponseDto })
  @Patch(':id')
  async updateWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.workflow.findUniqueOrThrow({ where: { id } });
      if (dto.rules) {
        await transaction.workflowRule.deleteMany({ where: { workflowId: id } });
      }
      return transaction.workflow.update({
        where: { id },
        data: {
          name: dto.name,
          triggerEvent: dto.triggerEvent,
          isActive: dto.isActive,
          rules: dto.rules
            ? {
                create: dto.rules.map((rule) => ({
                  conditionJson: rule.conditionJson as Prisma.InputJsonValue,
                  actionJson: rule.actionJson as Prisma.InputJsonValue,
                  orderIndex: rule.orderIndex ?? 0,
                })),
              }
            : undefined,
        },
        include: { rules: true },
      });
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Deleted successfully', type: ApiSuccessResponseDto })
  @Delete(':id')
  async deleteWorkflow(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.workflow.delete({ where: { id } });
    return { success: true, message: 'Workflow deleted successfully' };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('executions')
  async findExecutions(@Query() query: PaginationQueryDto) {
    const pagination = normalizePagination(query.page, query.limit);
    const [data, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      }),
      this.prisma.workflowExecution.count(),
    ]);
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('executions/:id/logs')
  async findExecutionLogs(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto) {
    const pagination = normalizePagination(query.page, query.limit);
    const where = { executionId: id };
    const [data, total] = await Promise.all([
      this.prisma.workflowLog.findMany({
      where: { executionId: id },
      orderBy: { createdAt: 'asc' },
      skip: pagination.skip,
      take: pagination.take,
      }),
      this.prisma.workflowLog.count({ where }),
    ]);
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  findWorkflow(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.workflow.findUniqueOrThrow({
      where: { id },
      include: { rules: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('trigger')
  trigger(@Body() dto: TriggerWorkflowDto, @Req() req: RequestWithUser) {
    void dto;
    void req;
    throw new ForbiddenException(
      'Manual workflow triggering is disabled. Workflows run from domain events only.',
    );
  }
}
