import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  CommunicationChannelType,
  ConversationStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const conversationSelect = {
  id: true,
  customerId: true,
  channelType: true,
  externalConversationId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  participants: true,
} as const;

const conversationHistorySelect = {
  ...conversationSelect,
  messages: {
    orderBy: {
      sentAt: 'asc',
    },
  },
} as const;

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ConversationCreateInput) {
    return this.prisma.conversation.create({
      data,
      select: conversationSelect,
    });
  }

  findMany(params?: {
    customerId?: string;
    channelType?: CommunicationChannelType;
    status?: ConversationStatus;
  }) {
    return this.prisma.conversation.findMany({
      where: params,
      select: conversationSelect,
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  findById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      select: conversationHistorySelect,
    });
  }

  updateStatus(id: string, status: ConversationStatus) {
    return this.prisma.conversation.update({
      where: { id },
      data: { status },
      select: conversationSelect,
    });
  }
}
