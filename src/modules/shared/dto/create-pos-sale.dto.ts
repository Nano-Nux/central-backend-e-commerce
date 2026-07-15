import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { PaymentMethod } from '../../../../generated/prisma/enums';
import { CreateOrderDto } from './create-order.dto';

export class CreatePOSSaleDto extends CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  sessionId!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({ type: () => Number })
  @Type(() => Number)
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paymentReference?: string;
}
