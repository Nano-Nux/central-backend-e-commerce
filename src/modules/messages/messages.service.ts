import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { MessageDirection } from '../../../generated/prisma/enums';
import { AuditContext, AuditService } from '../audit/audit.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesRepository } from './messages.repository';

export type StoreMessageInput = {
  conversationId: string;
  content: string;
  metadata?: Prisma.InputJsonValue;
  sentAt?: Date;
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly conversationsService: ConversationsService,
    private readonly auditService: AuditService,
  ) {}

  sendMessage(input: StoreMessageInput, context?: AuditContext) {
    return this.storeOutboundMessage(input, context);
  }

  async storeInboundMessage(input: StoreMessageInput, context?: AuditContext) {
    return this.storeMessage(input, MessageDirection.INBOUND, context);
  }

  async storeOutboundMessage(input: StoreMessageInput, context?: AuditContext) {
    return this.storeMessage(input, MessageDirection.OUTBOUND, context);
  }

  listConversationMessages(conversationId: string) {
    return this.messagesRepository.findByConversation(conversationId);
  }

  private async storeMessage(
    input: StoreMessageInput,
    direction: MessageDirection,
    context?: AuditContext,
  ) {
    await this.conversationsService.getConversationHistory(
      input.conversationId,
    );

    const message = await this.messagesRepository.create({
      conversationId: input.conversationId,
      direction,
      content: input.content,
      metadata: input.metadata,
      sentAt: input.sentAt ?? new Date(),
    });

    this.auditService.logCreate(
      'MESSAGE',
      message.id,
      {
        id: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
      },
      undefined,
      context,
    );

    return message;
  }
}
