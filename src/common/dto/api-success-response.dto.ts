import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiPaginationDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiPropertyOptional()
  totalPages?: number;

  @ApiPropertyOptional()
  hasNext?: boolean;

  @ApiPropertyOptional()
  hasPrevious?: boolean;
}

export class ApiSuccessResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({ type: Object })
  data?: unknown;

  @ApiPropertyOptional({ type: () => ApiPaginationDto })
  pagination?: ApiPaginationDto;
}
