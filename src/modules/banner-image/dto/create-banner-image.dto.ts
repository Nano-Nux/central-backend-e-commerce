import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class CreateBannerImageDto {
  @ApiProperty({ description: 'Image URL. The storefront presents it at 16:9.' })
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'Optional link opened when the banner is clicked.' })
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  @IsOptional()
  targetUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
