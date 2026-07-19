import { PartialType } from '@nestjs/swagger';
import { CreateBannerImageDto } from './create-banner-image.dto';

export class UpdateBannerImageDto extends PartialType(CreateBannerImageDto) {}
