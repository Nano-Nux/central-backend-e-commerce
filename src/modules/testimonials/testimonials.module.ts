import { Module } from '@nestjs/common';
import { TestimonialsController } from './testimonials.controller';
import { StoreTestimonialsController } from './store-testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({ controllers: [TestimonialsController, StoreTestimonialsController], providers: [TestimonialsService] })
export class TestimonialsModule {}
