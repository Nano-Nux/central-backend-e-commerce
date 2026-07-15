import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VoucherListQueryDto } from './dto/voucher-list-query.dto';
import { PromotionService } from './promotion.service';

@ApiTags('Vouchers')
@ApiBearerAuth()
@Controller('vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class PromotionController {
  constructor(private readonly service: PromotionService) {}
  @Post()
  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  async create(@Body() dto: CreateVoucherDto) { return { success: true, message: 'Voucher created successfully', data: await this.service.create(dto) }; }
  @Get()
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async list(@Query() query: VoucherListQueryDto) { const result = await this.service.list(query); return { success: true, message: 'Success', ...result }; }
  @Get(':id')
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) { return { success: true, message: 'Success', data: await this.service.findOne(id) }; }
  @Patch(':id')
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVoucherDto) { return { success: true, message: 'Voucher updated successfully', data: await this.service.update(id, dto) }; }
  @Delete(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Delete a voucher. Requires Admin.' })
  @ApiOkResponse({ type: ApiSuccessResponseDto })
  async delete(@Param('id', ParseUUIDPipe) id: string) { return { success: true, message: 'Voucher deleted successfully', data: await this.service.delete(id) }; }
}
