import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { OrderSource, OrderStatus } from '../../../../generated/prisma/enums';
import { PaginationQueryDto } from './pagination-query.dto';

export class OrderListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderSource })
  @IsEnum(OrderSource)
  @IsOptional()
  source?: OrderSource;
}
