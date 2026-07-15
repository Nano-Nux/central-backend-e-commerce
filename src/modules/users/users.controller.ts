import {
  Body,
  Controller,
  Get,
  Patch,
  Delete,
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
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRoleNames } from './user-roles';
import { UsersService } from './users.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('me')
  async findMe(@Req() request: AuthenticatedRequest) {
    const user = await this.usersService.findMe(request.user.id);

    return {
      success: true,
      message: 'Success',
      data: user,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleNames.ADMIN)
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.createStaffUser(createUserDto);

    return {
      success: true,
      message: 'User created successfully',
      data: user,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleNames.ADMIN)
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    const result = await this.usersService.findAll(query.page, query.limit);

    return {
      success: true,
      message: 'Success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleNames.ADMIN)
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);

    return {
      success: true,
      message: 'Success',
      data: user,
    };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleNames.ADMIN)
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.update(id, dto, {
      actorId: request.user?.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleNames.ADMIN)
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.remove(id, {
      actorId: request.user?.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
