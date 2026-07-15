import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsUUID, Min } from 'class-validator';

export class ClosePOSSessionDto {
  @ApiProperty()
  @IsUUID()
  sessionId!: string;

  @ApiPropertyOptional({ type: () => Number })
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  countedCash?: number;
}
