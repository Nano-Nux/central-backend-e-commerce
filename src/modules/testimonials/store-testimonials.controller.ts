import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TestimonialsService } from './testimonials.service';

@ApiTags('Store Testimonials')
@Controller('store/testimonials')
export class StoreTestimonialsController {
  constructor(private readonly service: TestimonialsService) {}
  @Get() list() { return { success: true, data: this.service.listActive() }; }
}
