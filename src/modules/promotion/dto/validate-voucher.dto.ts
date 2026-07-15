import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Min } from 'class-validator';

export class ValidateVoucherDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cartTotal!: number;
}
