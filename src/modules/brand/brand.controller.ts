import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BrandService } from './brand.service';
import { BrandListQueryDto } from './dto/brand-list-query.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('Brands')
@ApiBearerAuth()
@Controller('brands')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class BrandController {
  constructor(private readonly service: BrandService) {}

  @Post()
  @ApiOperation({ summary: 'Create a landing-page brand advertisement.' })
  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  async create(@Body() dto: CreateBrandDto) {
    return { success: true, message: 'Brand created successfully', data: await this.service.create(dto) };
  }

  @Get()
  @ApiOperation({ summary: 'List brand advertisements. Requires Admin or Manager.' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async findAll(@Query() query: BrandListQueryDto) {
    const result = await this.service.findAll(query);
    return { success: true, message: 'Success', ...result };
  }

  @Get(':id')
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, message: 'Success', data: await this.service.findOne(id) };
  }

  @Patch(':id')
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto) {
    return { success: true, message: 'Brand updated successfully', data: await this.service.update(id, dto) };
  }

  @Delete(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Delete a brand. Requires Admin.' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, message: 'Brand deleted successfully', data: await this.service.delete(id) };
  }
}
