import { Module } from '@nestjs/common';
import { BannerImageController } from './banner-image.controller';
import { BannerImageRepository } from './banner-image.repository';
import { BannerImageService } from './banner-image.service';

@Module({
  controllers: [BannerImageController],
  providers: [BannerImageService, BannerImageRepository],
  exports: [BannerImageService, BannerImageRepository],
})
export class BannerImageModule {}
