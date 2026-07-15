import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { WorkflowExecutionStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { ActionExecutorService } from '../executors/action-executor.service';
import { WorkflowRulesService } from '../rules/workflow-rules.service';

type WorkflowWithRules = Prisma.WorkflowGetPayload<{
  include: {
    rules: true;
  };
}>;

@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowRulesService: WorkflowRulesService,
    private readonly actionExecutorService: ActionExecutorService,
    private readonly auditService: AuditService,
  ) {}

  async executeWorkflow(
    workflow: WorkflowWithRules,
    inputJson: Prisma.InputJsonValue,
    context?: AuditContext,
    eventKey?: string | null,
  ) {
    let execution: Awaited<
      ReturnType<PrismaService['workflowExecution']['findUnique']>
    > extends infer T
      ? Exclude<T, null>
      : never;

    try {
      if (eventKey) {
        const existingExecution = await this.prisma.workflowExecution.findUnique({
          where: { eventKey },
        });

        if (existingExecution) {
          if (existingExecution.status === WorkflowExecutionStatus.SUCCESS) {
            return existingExecution;
          }

          if (existingExecution.status === WorkflowExecutionStatus.RUNNING) {
            return existingExecution;
          }

          execution = await this.prisma.workflowExecution.update({
            where: { id: existingExecution.id },
            data: {
              status: WorkflowExecutionStatus.RUNNING,
              inputJson,
            },
          });
        } else {
          execution = await this.prisma.workflowExecution.create({
            data: {
              workflowId: workflow.id,
              eventKey,
              status: WorkflowExecutionStatus.RUNNING,
              inputJson,
              outputJson: {
                actionCount: 0,
                actions: [],
                completedRuleIds: [],
              },
            },
          });
        }
      } else {
        execution = await this.prisma.workflowExecution.create({
          data: {
            workflowId: workflow.id,
            status: WorkflowExecutionStatus.RUNNING,
            inputJson,
            outputJson: {
              actionCount: 0,
              actions: [],
              completedRuleIds: [],
            },
          },
        });
      }
    } catch (error) {
      if (
        eventKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingExecution = await this.prisma.workflowExecution.findUnique({
          where: { eventKey },
        });

        if (existingExecution) {
          return existingExecution;
        }
      }

      throw error;
    }

    await this.log(execution.id, 'INFO', `Workflow started: ${workflow.name}`);

    const checkpoint = this.readCheckpoint(execution.outputJson);
    const actions = [...checkpoint.actions];
    const completedRuleIds = new Set(checkpoint.completedRuleIds);

    try {
      for (const rule of workflow.rules) {
        const matched = this.workflowRulesService.evaluateCondition(
          rule.conditionJson,
          inputJson,
        );

        await this.log(
          execution.id,
          'INFO',
          `Rule ${rule.id} ${matched ? 'matched' : 'skipped'}`,
        );

        if (!matched) {
          continue;
        }

        if (completedRuleIds.has(rule.id)) {
          await this.log(
            execution.id,
            'INFO',
            `Rule ${rule.id} already executed on retry`,
          );
          continue;
        }

        const result = await this.actionExecutorService.execute(
          rule.actionJson,
          inputJson,
          context,
        );

        actions.push(result as Prisma.InputJsonValue);
        completedRuleIds.add(rule.id);
        await this.prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            outputJson: {
              actionCount: actions.length,
              actions,
              completedRuleIds: Array.from(completedRuleIds),
            },
          },
        });
        await this.log(execution.id, 'INFO', `Rule ${rule.id} action executed`);
      }

      const outputJson = {
        actionCount: actions.length,
        actions,
      };
      const updated = await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: WorkflowExecutionStatus.SUCCESS,
          outputJson,
        },
      });

      this.auditService.logAction(
        'WORKFLOW_EXECUTED',
        'WORKFLOW',
        workflow.id,
        undefined,
        {
          workflowId: workflow.id,
          executionId: execution.id,
          status: updated.status,
        },
        undefined,
        context,
      );

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Workflow failed';

      await this.log(execution.id, 'ERROR', message);

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: WorkflowExecutionStatus.FAILED,
          outputJson: {
            actionCount: actions.length,
            actions,
            completedRuleIds: Array.from(completedRuleIds),
            error: message,
          },
        },
      });

      this.auditService.logAction(
        'WORKFLOW_FAILED',
        'WORKFLOW',
        workflow.id,
        undefined,
        {
          workflowId: workflow.id,
          executionId: execution.id,
          error: message,
        },
        undefined,
        context,
      );

      throw error;
    }
  }

  private log(executionId: string, level: string, message: string) {
    return this.prisma.workflowLog.create({
      data: {
        executionId,
        level,
        message,
      },
    });
  }

  private readCheckpoint(outputJson: Prisma.JsonValue | null) {
    if (
      !outputJson ||
      typeof outputJson !== 'object' ||
      Array.isArray(outputJson)
    ) {
      return {
        actions: [] as Prisma.InputJsonValue[],
        completedRuleIds: [] as string[],
      };
    }

    const value = outputJson as Record<string, unknown>;
    const actions = Array.isArray(value.actions)
      ? (value.actions as Prisma.InputJsonValue[])
      : [];
    const completedRuleIds = Array.isArray(value.completedRuleIds)
      ? value.completedRuleIds.filter(
          (entry): entry is string => typeof entry === 'string',
        )
      : [];

    return {
      actions,
      completedRuleIds,
    };
  }
}
