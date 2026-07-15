import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { PaymentMethod } from '../../../../generated/prisma/enums';

export class CreateSupplierPaymentDto {
  @ApiProperty()
  @IsUUID()
  supplierInvoiceId!: string;

  @ApiProperty({ type: () => Number })
  @Type(() => Number)
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paymentDate?: string;
}
