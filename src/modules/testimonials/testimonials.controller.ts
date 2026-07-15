import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min, MinLength } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TestimonialsService } from './testimonials.service';

class TestimonialDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() role?: string;
  @ApiProperty() @IsString() @MinLength(5) content!: string;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(5) @IsOptional() rating?: number;
  @ApiPropertyOptional() @IsUrl() @IsOptional() imageUrl?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

class UpdateTestimonialDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() role?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() content?: string;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(5) @IsOptional() rating?: number;
  @ApiPropertyOptional() @IsUrl() @IsOptional() imageUrl?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

@ApiTags('Testimonials')
@Controller('testimonials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class TestimonialsController {
  constructor(private readonly service: TestimonialsService) {}
  @Get() list() { return { success: true, data: this.service.list() }; }
  @Post() create(@Body() dto: TestimonialDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTestimonialDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
