import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  CommunicationChannelType,
  ConversationParticipantType,
  ConversationStatus,
} from '../../../generated/prisma/enums';
import { AuditContext, AuditService } from '../audit/audit.service';
import { ConversationsRepository } from './conversations.repository';

export type CreateConversationInput = {
  customerId?: string | null;
  channelType: CommunicationChannelType;
  externalConversationId?: string | null;
  participants?: Array<{
    participantType: ConversationParticipantType;
    participantId: string;
  }>;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly auditService: AuditService,
  ) {}

  async createConversation(
    input: CreateConversationInput,
    context?: AuditContext,
  ) {
    const conversation = await this.conversationsRepository.create({
      customer: input.customerId
        ? { connect: { id: input.customerId } }
        : undefined,
      channelType: input.channelType,
      externalConversationId: input.externalConversationId ?? undefined,
      status: ConversationStatus.OPEN,
      participants: input.participants?.length
        ? {
            create: input.participants,
          }
        : undefined,
    });

    this.auditService.logCreate(
      'CONVERSATION',
      conversation.id,
      this.snapshot(conversation),
      undefined,
      context,
    );

    return conversation;
  }

  listConversations(params?: {
    customerId?: string;
    channelType?: CommunicationChannelType;
    status?: ConversationStatus;
  }) {
    return this.conversationsRepository.findMany(params);
  }

  async getConversationHistory(id: string) {
    const conversation = await this.conversationsRepository.findById(id);

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async closeConversation(id: string, context?: AuditContext) {
    const before = await this.getConversationHistory(id);
    const conversation = await this.conversationsRepository.updateStatus(
      id,
      ConversationStatus.CLOSED,
    );

    this.auditService.logUpdate(
      'CONVERSATION',
      id,
      { status: before.status },
      { status: conversation.status },
      undefined,
      context,
    );

    return conversation;
  }

  private snapshot(conversation: {
    id: string;
    customerId: string | null;
    channelType: CommunicationChannelType;
    status: ConversationStatus;
  }): Prisma.InputJsonValue {
    return {
      id: conversation.id,
      customerId: conversation.customerId,
      channelType: conversation.channelType,
      status: conversation.status,
    };
  }
}
