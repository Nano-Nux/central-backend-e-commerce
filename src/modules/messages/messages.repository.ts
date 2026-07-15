import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MessageUncheckedCreateInput) {
    return this.prisma.message.create({
      data,
    });
  }

  findByConversation(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: {
        sentAt: 'asc',
      },
    });
  }
}
