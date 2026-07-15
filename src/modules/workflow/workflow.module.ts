import { Module } from '@nestjs/common';

import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationModule } from '../communication/communication.module';
import { CrmModule } from '../crm/crm.module';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { ActionExecutorService } from '../executors/action-executor.service';
import { WorkflowRulesService } from '../rules/workflow-rules.service';
import { TriggerService } from '../triggers/trigger.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowDomainEventsHandler } from './workflow-domain-events.handler';

@Module({
  imports: [
    AiGatewayModule,
    AuditModule,
    AuthModule,
    CommunicationModule,
    CrmModule,
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowEngineService,
    TriggerService,
    ActionExecutorService,
    WorkflowRulesService,
    WorkflowDomainEventsHandler,
  ],
  exports: [TriggerService, WorkflowEngineService],
})
export class WorkflowModule {}
