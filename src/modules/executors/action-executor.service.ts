import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  AiModuleSource,
  AiProviderName,
} from '../../../generated/prisma/enums';
import { AuditContext, AuditService } from '../audit/audit.service';
import { AiGatewayService } from '../core/ai-gateway.service';
import { CustomerActivitiesService } from '../customer-activities/customer-activities.service';
import { CustomersService } from '../customers/customers.service';
import { EmailService } from '../email/email.service';
import { MessagesService } from '../messages/messages.service';
import { EmailTemplatesService } from '../templates/email-templates.service';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailTemplatesService: EmailTemplatesService,
    private readonly messagesService: MessagesService,
    private readonly customersService: CustomersService,
    private readonly customerActivitiesService: CustomerActivitiesService,
    private readonly auditService: AuditService,
    private readonly aiGatewayService: AiGatewayService,
  ) {}

  async execute(
    actionJson: Prisma.JsonValue,
    inputJson: Prisma.InputJsonValue,
    context?: AuditContext,
  ) {
    if (!this.isRecord(actionJson) || typeof actionJson.type !== 'string') {
      throw new BadRequestException('Workflow action type is required');
    }

    switch (actionJson.type) {
      case 'send_email':
        return this.sendEmail(actionJson, inputJson, context);
      case 'send_message':
        return this.sendMessage(actionJson, inputJson, context);
      case 'create_notification':
        return this.createNotification(actionJson, inputJson, context);
      case 'update_record':
        return this.updateRecord(actionJson, inputJson, context);
      case 'create_audit_log':
        return this.createAuditLog(actionJson, inputJson, context);
      case 'ai_request':
        return this.runAiRequest(actionJson, inputJson);
      default:
        throw new BadRequestException('Unsupported workflow action type');
    }
  }

  private async sendEmail(
    action: JsonRecord,
    inputJson: Prisma.InputJsonValue,
    context?: AuditContext,
  ) {
    const toEmail = this.requiredString(action.toEmail, 'toEmail', inputJson);
    const scheduledAt = this.optionalDate(action.scheduledAt, inputJson);
    const variables = this.resolveVariables(action.variables, inputJson);
    let subject = this.optionalString(action.subject, inputJson);
    let body = this.optionalString(action.body, inputJson);

    if (typeof action.templateName === 'string') {
      const rendered = await this.emailTemplatesService.renderTemplate(
        this.interpolate(action.templateName, inputJson),
        variables,
      );
      subject = rendered.subject;
      body = rendered.body;
    }

    if (!subject || !body) {
      throw new BadRequestException('Email subject and body are required');
    }

    const email = await this.emailService.queueEmail(
      {
        toEmail,
        subject,
        body,
        scheduledAt,
      },
      context,
    );

    return {
      type: 'send_email',
      emailQueueId: email.id,
    };
  }

  private async sendMessage(
    action: JsonRecord,
    inputJson: Prisma.InputJsonValue,
    context?: AuditContext,
  ) {
    const message = await this.messagesService.sendMessage(
      {
        conversationId: this.requiredString(
          action.conversationId,
          'conversationId',
          inputJson,
        ),
        content: this.requiredString(action.content, 'content', inputJson),
        metadata: this.optionalJson(action.metadata, inputJson),
      },
      context,
    );

    return {
      type: 'send_message',
      messageId: message.id,
    };
  }

  private createNotification(
    action: JsonRecord,
    inputJson: Prisma.InputJsonValue,
    context?: AuditContext,
  ) {
    const entityId = this.requiredString(
      action.entityId,
      'entityId',
      inputJson,
    );
    const after = {
      title: this.optionalString(action.title, inputJson),
      message: this.optionalString(action.message, inputJson),
      metadata: this.optionalJson(action.metadata, inputJson),
    };

    this.auditService.logAction(
      'WORKFLOW_NOTIFICATION_CREATED',
      'NOTIFICATION',
      entityId,
      undefined,
      after,
      { workflowAction: 'create_notification' },
      context,
    );

    return {
      type: 'create_notification',
      entityId,
    };
  }

  private async updateRecord(
    action: JsonRecord,
    inputJson: Prisma.InputJsonValue,
    context?: AuditContext,
  ) {
    const target = this.requiredString(action.target, 'target', inputJson);

    if (target === 'customer') {
      const customer = await this.customersService.update(
        this.requiredString(action.id, 'id', inputJson),
        this.optionalJson(action.data, inputJson) as {
          name?: string;
          phone?: string;
          email?: string;
          type?: 'RETAIL' | 'WHOLESALE';
          userId?: string;
        },
        context,
      );

      return {
        type: 'update_record',
        target,
        id: customer.id,
      };
    }

    if (target === 'customer_activity') {
      const activity = await this.customerActivitiesService.recordActivity({
        customerId: this.requiredString(
          action.customerId,
          'customerId',
          inputJson,
        ),
        type: this.requiredString(
          action.activityType,
          'activityType',
          inputJson,
        ),
        description: this.requiredString(
          action.description,
          'description',
          inputJson,
        ),
        metadata: this.optionalJson(action.metadata, inputJson),
      });

      return {
        type: 'update_record',
        target,
        id: activity.id,
      };
    }

    throw new BadRequestException('Unsupported safe update target');
  }

  private createAuditLog(
    action: JsonRecord,
    inputJson: Prisma.InputJsonValue,
    context?: AuditContext,
  ) {
    const auditAction = this.requiredString(action.action, 'action', inputJson);
    const entityType = this.requiredString(
      action.entityType,
      'entityType',
      inputJson,
    );
    const entityId = this.requiredString(
      action.entityId,
      'entityId',
      inputJson,
    );

    this.auditService.logAction(
      auditAction,
      entityType,
      entityId,
      this.optionalJson(action.before, inputJson),
      this.optionalJson(action.after, inputJson),
      this.optionalJson(action.metadata, inputJson),
      context,
    );

    return {
      type: 'create_audit_log',
      action: auditAction,
      entityType,
      entityId,
    };
  }

  private async runAiRequest(
    action: JsonRecord,
    inputJson: Prisma.InputJsonValue,
  ) {
    const result = await this.aiGatewayService.run({
      moduleSource: AiModuleSource.WORKFLOW,
      operation: this.requiredString(
        action.operation,
        'operation',
        inputJson,
      ) as
        | 'text_generation'
        | 'classification'
        | 'summarization'
        | 'extraction',
      prompt: this.requiredString(action.prompt, 'prompt', inputJson),
      inputJson: this.optionalJson(action.inputJson, inputJson) ?? inputJson,
      providerId: this.optionalString(action.providerId, inputJson),
      providerName: this.optionalProviderName(action.providerName, inputJson),
      sessionId: this.optionalString(action.sessionId, inputJson),
    });

    return {
      type: 'ai_request',
      requestId: result.requestId,
      providerId: result.providerId,
      suggestionOnly: result.suggestionOnly,
      outputJson: result.outputJson,
    };
  }

  private requiredString(
    value: unknown,
    fieldName: string,
    inputJson: Prisma.InputJsonValue,
  ) {
    const resolved = this.optionalString(value, inputJson);

    if (!resolved) {
      throw new BadRequestException(`Workflow action ${fieldName} is required`);
    }

    return resolved;
  }

  private optionalString(value: unknown, inputJson: Prisma.InputJsonValue) {
    return typeof value === 'string'
      ? this.interpolate(value, inputJson)
      : undefined;
  }

  private optionalDate(value: unknown, inputJson: Prisma.InputJsonValue) {
    const resolved = this.optionalString(value, inputJson);

    return resolved ? new Date(resolved) : undefined;
  }

  private optionalJson(value: unknown, inputJson: Prisma.InputJsonValue) {
    return this.resolveValue(value, inputJson) as
      | Prisma.InputJsonValue
      | undefined;
  }

  private optionalProviderName(
    value: unknown,
    inputJson: Prisma.InputJsonValue,
  ) {
    const resolved = this.optionalString(value, inputJson);

    return resolved &&
      Object.values(AiProviderName).includes(resolved as AiProviderName)
      ? (resolved as AiProviderName)
      : undefined;
  }

  private resolveVariables(value: unknown, inputJson: Prisma.InputJsonValue) {
    const resolved = this.resolveValue(value, inputJson);

    return this.isRecord(resolved)
      ? Object.fromEntries(
          Object.entries(resolved)
            .filter(([, item]) =>
              ['string', 'number', 'boolean'].includes(typeof item),
            )
            .map(([key, item]) => [key, item as string | number | boolean]),
        )
      : {};
  }

  private resolveValue(
    value: unknown,
    inputJson: Prisma.InputJsonValue,
  ): unknown {
    if (typeof value === 'string') {
      return this.interpolate(value, inputJson);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, inputJson));
    }

    if (this.isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.resolveValue(item, inputJson),
        ]),
      );
    }

    return value;
  }

  private interpolate(value: string, inputJson: Prisma.InputJsonValue) {
    return value.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
      const resolved = this.getPathValue(inputJson, path);

      return resolved === undefined || resolved === null
        ? ''
        : String(resolved);
    });
  }

  private getPathValue(inputJson: Prisma.InputJsonValue, path: string) {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!this.isRecord(current)) {
        return undefined;
      }

      return current[key];
    }, inputJson);
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
