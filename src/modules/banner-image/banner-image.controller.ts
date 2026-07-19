import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BannerImageService } from './banner-image.service';
import { BannerImageListQueryDto } from './dto/banner-image-list-query.dto';
import { CreateBannerImageDto } from './dto/create-banner-image.dto';
import { UpdateBannerImageDto } from './dto/update-banner-image.dto';

@ApiTags('Banner Images')
@ApiBearerAuth()
@Controller('banner-images')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class BannerImageController {
  constructor(private readonly service: BannerImageService) {}

  @Post()
  @ApiOperation({ summary: 'Create a landing-page banner image.' })
  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  async create(@Body() dto: CreateBannerImageDto) {
    return { success: true, message: 'Banner image created successfully', data: await this.service.create(dto) };
  }

  @Get()
  @ApiOperation({ summary: 'List landing-page banner images.' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async findAll(@Query() query: BannerImageListQueryDto) {
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
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerImageDto) {
    return { success: true, message: 'Banner image updated successfully', data: await this.service.update(id, dto) };
  }

  @Delete(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Delete a landing-page banner image.' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, message: 'Banner image deleted successfully', data: await this.service.delete(id) };
  }
}
