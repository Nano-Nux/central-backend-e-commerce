import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateOrderDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orderNotes?: string | null;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  shippingAddress?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  billingAddress?: Record<string, unknown> | null;
}
