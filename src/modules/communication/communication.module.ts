import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationController } from './communication.controller';
import { ConversationsRepository } from '../conversations/conversations.repository';
import { ConversationsService } from '../conversations/conversations.service';
import { EmailRepository } from '../email/email.repository';
import { EmailService } from '../email/email.service';
import { MessagesRepository } from '../messages/messages.repository';
import { MessagesService } from '../messages/messages.service';
import { EmailTemplatesService } from '../templates/email-templates.service';
import { TelegramService } from './telegram.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [CommunicationController],
  providers: [
    ConversationsService,
    ConversationsRepository,
    MessagesService,
    MessagesRepository,
    EmailService,
    EmailRepository,
    EmailTemplatesService,
    TelegramService,
  ],
  exports: [
    ConversationsService,
    MessagesService,
    EmailService,
    EmailTemplatesService,
    TelegramService,
  ],
})
export class CommunicationModule {}
