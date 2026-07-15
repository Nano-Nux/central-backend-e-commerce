import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { AuditContext, AuditService } from '../audit/audit.service';
import { EMAIL_QUEUE_STATUS, EmailRepository } from './email.repository';

export type QueueEmailInput = {
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt?: Date;
};

export type EmailSender = {
  send(input: {
    toEmail: string;
    subject: string;
    body: string;
    configJson: Prisma.JsonValue;
  }): Promise<void>;
};

@Injectable()
export class EmailService {
  constructor(
    private readonly emailRepository: EmailRepository,
    private readonly auditService: AuditService,
  ) {}

  async queueEmail(input: QueueEmailInput, context?: AuditContext) {
    const queuedEmail = await this.emailRepository.queue({
      toEmail: input.toEmail,
      subject: input.subject,
      body: input.body,
      status: EMAIL_QUEUE_STATUS.PENDING,
      scheduledAt: input.scheduledAt ?? new Date(),
    });

    this.auditService.logCreate(
      'EMAIL_QUEUE',
      queuedEmail.id,
      {
        id: queuedEmail.id,
        toEmail: queuedEmail.toEmail,
        status: queuedEmail.status,
      },
      undefined,
      context,
    );

    return queuedEmail;
  }

  async processQueue(sender: EmailSender, limit = 50, context?: AuditContext) {
    const channel = await this.emailRepository.getEmailChannel();

    if (!channel) {
      throw new BadRequestException('Enabled email channel is not configured');
    }

    const dueEmails = await this.emailRepository.findDue(limit);
    const processed: Awaited<ReturnType<EmailRepository['updateStatus']>>[] =
      [];

    for (const email of dueEmails) {
      await this.emailRepository.updateStatus(
        email.id,
        EMAIL_QUEUE_STATUS.PROCESSING,
      );

      try {
        await sender.send({
          toEmail: email.toEmail,
          subject: email.subject,
          body: email.body,
          configJson: channel.configJson,
        });

        const sentEmail = await this.emailRepository.updateStatus(
          email.id,
          EMAIL_QUEUE_STATUS.SENT,
          new Date(),
        );
        processed.push(sentEmail);
      } catch {
        const failedEmail = await this.emailRepository.updateStatus(
          email.id,
          EMAIL_QUEUE_STATUS.FAILED,
        );
        processed.push(failedEmail);
      }
    }

    this.auditService.logAction(
      'EMAIL_QUEUE_PROCESSED',
      'EMAIL_QUEUE',
      'BATCH',
      undefined,
      { count: processed.length },
      undefined,
      context,
    );

    return processed;
  }

  configureEmailChannel(
    configJson: Prisma.InputJsonValue,
    isEnabled?: boolean,
  ) {
    return this.emailRepository.upsertChannel(configJson, isEnabled);
  }
}
