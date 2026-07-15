import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { eventNameCandidates } from '../../common/constants/event.constants';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditContext } from '../audit/audit.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';

@Injectable()
export class TriggerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngineService: WorkflowEngineService,
  ) {}

  async dispatchMatchingWorkflows(
    triggerEvent: string,
    inputJson: Prisma.InputJsonValue,
    context?: AuditContext,
  ) {
    const triggerEventNames = eventNameCandidates(triggerEvent);
    const workflows = await this.prisma.workflow.findMany({
      where: {
        triggerEvent: {
          in: triggerEventNames,
        },
        isActive: true,
      },
      include: {
        rules: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    return Promise.all(
      workflows.map((workflow) =>
        this.workflowEngineService.executeWorkflow(
          workflow,
          inputJson,
          context,
          this.buildWorkflowEventKey(workflow.id, triggerEvent, inputJson),
        ),
      ),
    );
  }

  private buildWorkflowEventKey(
    workflowId: string,
    triggerEvent: string,
    inputJson: Prisma.InputJsonValue,
  ) {
    const eventEnvelope =
      inputJson &&
      typeof inputJson === 'object' &&
      !Array.isArray(inputJson)
        ? (inputJson as Record<string, unknown>)
        : null;
    const eventId =
      typeof eventEnvelope?.eventId === 'string' ? eventEnvelope.eventId : null;
    const payload =
      eventEnvelope?.payload &&
      typeof eventEnvelope.payload === 'object' &&
      !Array.isArray(eventEnvelope.payload)
        ? (eventEnvelope.payload as Record<string, unknown>)
        : null;
    const payment =
      payload?.payment &&
      typeof payload.payment === 'object' &&
      !Array.isArray(payload.payment)
        ? (payload.payment as Record<string, unknown>)
        : null;
    const refundPayment =
      payload?.refundPayment &&
      typeof payload.refundPayment === 'object' &&
      !Array.isArray(payload.refundPayment)
        ? (payload.refundPayment as Record<string, unknown>)
        : null;
    const businessKey =
      typeof payload?.id === 'string'
        ? payload.id
        : typeof payload?.goodsReceiptId === 'string'
          ? payload.goodsReceiptId
          : typeof payload?.referenceId === 'string'
            ? payload.referenceId
            : typeof payment?.id === 'string'
              ? payment.id
              : typeof refundPayment?.id === 'string'
                ? refundPayment.id
                : null;

    if (businessKey) {
      return `${workflowId}:${triggerEvent}:${businessKey}`;
    }

    if (eventId) {
      return `${workflowId}:${triggerEvent}:${eventId}`;
    }

    return null;
  }
}
