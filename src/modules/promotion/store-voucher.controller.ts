import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateVoucherDto } from './dto/validate-voucher.dto';
import { PromotionService } from './promotion.service';

@ApiTags('Store Promotions')
@Controller('store/vouchers')
export class StoreVoucherController {
  constructor(private readonly service: PromotionService) {}
  @Post('validate')
  @ApiOperation({ summary: 'Validate a voucher against a cart total' })
  @ApiOkResponse()
  async validate(@Body() dto: ValidateVoucherDto) { return { success: true, message: 'Voucher is valid', data: await this.service.validate(dto) }; }
}
