import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { createPaginationMeta, normalizePagination } from '../shared/helpers/pagination.helper';

export type CreateTicketInput = {
  customerId?: string;
  guestName?: string;
  guestEmail?: string;
  subject: string;
  description: string;
  priority?: string;
};

export type UpdateTicketInput = Partial<CreateTicketInput> & { status?: string; assignedToUserId?: string | null };

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId?: string, page = 1, limit = 20) {
    const pagination = normalizePagination(page, limit);
    const where = customerId ? { customerId } : undefined;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  get(id: string) {
    return this.prisma.supportTicket.findUniqueOrThrow({ where: { id } });
  }

  async create(input: CreateTicketInput) {
    if (input.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    return this.prisma.supportTicket.create({
      data: {
        customerId: input.customerId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        subject: input.subject,
        description: input.description,
        priority: input.priority ?? 'NORMAL',
      },
    });
  }

  update(id: string, input: UpdateTicketInput) {
    return this.prisma.supportTicket.update({ where: { id }, data: input });
  }
}
