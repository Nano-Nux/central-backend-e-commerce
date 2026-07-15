import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TicketsService } from './tickets.service';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

class CreateTicketDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] })
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;
}

class UpdateTicketDto extends CreateTicketDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] })
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  assignedToUserId?: string | null;
}

@ApiTags('Support Tickets')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Staff', 'Support Agent', 'Sales Agent')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'List support tickets' })
  @ApiOkResponse({ description: 'Success' })
  list(@Query('customerId') customerId: string | undefined, @Query() query: PaginationQueryDto) {
    return this.ticketsService.list(customerId, query.page, query.limit);
  }

  @Get('customers/:customerId/tickets')
  @ApiOperation({ summary: 'List tickets for a customer' })
  @ApiOkResponse({ description: 'Success' })
  listCustomerTickets(@Param('customerId', ParseUUIDPipe) customerId: string, @Query() query: PaginationQueryDto) {
    return this.ticketsService.list(customerId, query.page, query.limit);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get a support ticket' })
  @ApiOkResponse({ description: 'Success' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.get(id);
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiCreatedResponse({ description: 'Created successfully' })
  create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update a support ticket' })
  @ApiOkResponse({ description: 'Updated successfully' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(id, dto);
  }
}
