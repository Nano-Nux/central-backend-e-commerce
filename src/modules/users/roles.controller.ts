import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';

class RoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class RolesController {
  constructor(private readonly usersService: UsersService) {}

  @Get() @ApiOperation({ summary: 'List roles' }) list() { return this.usersService.listRoles(); }
  @Get(':id') @ApiOperation({ summary: 'Get role' }) get(@Param('id', ParseUUIDPipe) id: string) { return this.usersService.findRole(id); }
  @Post() create(@Body() dto: RoleDto) { return this.usersService.createRole(dto.name); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RoleDto) { return this.usersService.updateRole(id, dto.name); }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.usersService.deleteRole(id); }
}
