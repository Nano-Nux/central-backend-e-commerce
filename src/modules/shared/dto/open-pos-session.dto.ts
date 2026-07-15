import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Min } from 'class-validator';

export class OpenPOSSessionDto {
  @ApiProperty({ type: () => Number })
  @Type(() => Number)
  @Min(0)
  cashInHand!: number;
}
