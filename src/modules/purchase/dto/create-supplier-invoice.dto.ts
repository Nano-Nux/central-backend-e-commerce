import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsUUID, Min } from 'class-validator';

export class CreateSupplierInvoiceDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiProperty()
  @IsUUID()
  purchaseOrderId!: string;

  @ApiProperty({ type: () => Number })
  @Type(() => Number)
  @Min(0.01)
  totalAmount!: number;
}
