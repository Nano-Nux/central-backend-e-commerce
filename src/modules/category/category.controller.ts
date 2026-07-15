import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateCategoryDto } from '../shared/dto/create-category.dto';
import { UpdateCategoryDto } from '../shared/dto/update-category.dto';
import { CategoryListQueryDto } from '../shared/dto/category-list-query.dto';
import { CategoryService } from './category.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post()
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    const category = await this.categoryService.create(createCategoryDto);

    return {
      success: true,
      message: 'Category created successfully',
      data: category,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get()
  async findAll(@Query() query: CategoryListQueryDto) {
    const categories = await this.categoryService.list(query);

    return {
      success: true,
      message: 'Success',
      data: categories,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('tree')
  async getTree() {
    const tree = await this.categoryService.getTree();

    return {
      success: true,
      message: 'Success',
      data: tree,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const category = await this.categoryService.findOne(id);

    return {
      success: true,
      message: 'Success',
      data: category,
    };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.categoryService.update(id, updateCategoryDto);

    return {
      success: true,
      message: 'Category updated successfully',
      data: category,
    };
  }

  @ApiOperation({ summary: 'Requires role: Admin' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Roles('Admin')
  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    const category = await this.categoryService.delete(id);

    return {
      success: true,
      message: 'Category deleted successfully',
      data: category,
    };
  }
}
