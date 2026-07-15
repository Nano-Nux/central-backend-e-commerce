import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type TestimonialInput = { name: string; role?: string; content: string; rating?: number; imageUrl?: string; isActive?: boolean };

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}
  listActive() { return this.prisma.testimonial.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } }); }
  list() { return this.prisma.testimonial.findMany({ orderBy: { createdAt: 'desc' } }); }
  create(input: TestimonialInput) { return this.prisma.testimonial.create({ data: { id: randomUUID(), ...input } }); }
  async update(id: string, input: Partial<TestimonialInput>) { await this.get(id); return this.prisma.testimonial.update({ where: { id }, data: input }); }
  async remove(id: string) { await this.get(id); return this.prisma.testimonial.delete({ where: { id } }); }
  private async get(id: string) { const item = await this.prisma.testimonial.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Testimonial not found'); return item; }
}
