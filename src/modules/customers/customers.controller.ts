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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CustomerActivitiesService } from '../customer-activities/customer-activities.service';
import { CustomerNotesService } from '../customer-notes/customer-notes.service';
import { CustomerTagsService } from '../customer-tags/customer-tags.service';
import { CreateCustomerDto } from '../crm/dto/create-customer.dto';
import { CreateCustomerNoteDto } from '../crm/dto/create-customer-note.dto';
import { CreateCustomerTagDto } from '../crm/dto/create-customer-tag.dto';
import { CustomerListQueryDto } from '../crm/dto/customer-list-query.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { UpdateCustomerDto } from '../crm/dto/update-customer.dto';
import { CustomersService } from './customers.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Support Agent', 'Sales Agent')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customerTagsService: CustomerTagsService,
    private readonly customerNotesService: CustomerNotesService,
    private readonly customerActivitiesService: CustomerActivitiesService,
  ) {}

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('tags')
  async createTag(
    @Body() dto: CreateCustomerTagDto,
    @Req() req: RequestWithUser,
  ) {
    const tag = await this.customerTagsService.create(dto, this.context(req));

    return {
      success: true,
      message: 'Customer tag created successfully',
      data: tag,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('tags')
  async findTags() {
    const tags = await this.customerTagsService.findAll();

    return {
      success: true,
      message: 'Success',
      data: tags,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(@Body() dto: CreateCustomerDto, @Req() req: RequestWithUser) {
    const customer = await this.customersService.create(dto, this.context(req));

    return {
      success: true,
      message: 'Customer created successfully',
      data: customer,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll(@Query() query: CustomerListQueryDto) {
    const result = await this.customersService.findAll(query);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const customer = await this.customersService.findOne(id);

    return {
      success: true,
      message: 'Success',
      data: customer,
    };
  }

  @ApiOperation({ summary: 'List customer orders' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id/orders')
  async orders(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto) {
    const result = await this.customersService.findOrders(id, query.page, query.limit);
    return { success: true, message: 'Success', data: result.data, pagination: result.pagination };
  }

  @ApiOperation({ summary: 'List customer messages' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id/messages')
  async messages(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto) {
    const result = await this.customersService.findMessages(id, query.page, query.limit);
    return { success: true, message: 'Success', data: result.data, pagination: result.pagination };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: RequestWithUser,
  ) {
    const customer = await this.customersService.update(
      id,
      dto,
      this.context(req),
    );

    return {
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return {
      success: true,
      message: 'Customer deleted successfully',
      data: await this.customersService.remove(id, this.context(req)),
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(':id/tags/:tagId')
  async assignTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Req() req: RequestWithUser,
  ) {
    const tagMap = await this.customerTagsService.assign(
      id,
      tagId,
      this.context(req),
    );

    return {
      success: true,
      message: 'Customer tag assigned successfully',
      data: tagMap,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Delete(':id/tags/:tagId')
  async removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Req() req: RequestWithUser,
  ) {
    const tagMap = await this.customerTagsService.remove(
      id,
      tagId,
      this.context(req),
    );

    return {
      success: true,
      message: 'Customer tag removed successfully',
      data: tagMap,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post(':id/notes')
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCustomerNoteDto,
    @Req() req: RequestWithUser,
  ) {
    const note = await this.customerNotesService.addNote(
      id,
      dto,
      this.context(req),
    );

    return {
      success: true,
      message: 'Customer note added successfully',
      data: note,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id/notes')
  async listNotes(@Param('id', ParseUUIDPipe) id: string) {
    const notes = await this.customerNotesService.listNotes(id);

    return {
      success: true,
      message: 'Success',
      data: notes,
    };
  }

  @ApiOperation({
    summary: 'Requires roles: Admin, Manager, Support Agent, Sales Agent',
  })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id/timeline')
  async timeline(@Param('id', ParseUUIDPipe) id: string) {
    const activities = await this.customerActivitiesService.findByCustomer(id);

    return {
      success: true,
      message: 'Success',
      data: activities,
    };
  }

  private context(req: RequestWithUser) {
    return {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
