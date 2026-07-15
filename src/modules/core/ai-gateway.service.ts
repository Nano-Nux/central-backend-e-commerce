import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  AiModuleSource,
  AiProviderName,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AiLoggerService } from '../logger/ai-logger.service';
import {
  AiGatewayRequest,
  AiOperation,
  AiRouterService,
} from '../router/ai-router.service';

export type RunAiInput = {
  moduleSource: AiModuleSource;
  operation: AiOperation;
  prompt: string;
  inputJson?: Prisma.InputJsonValue;
  providerId?: string;
  providerName?: AiProviderName;
  sessionId?: string;
};

export type UpsertAiProviderInput = {
  name: AiProviderName;
  configJson: Prisma.InputJsonValue;
  isActive?: boolean;
};

@Injectable()
export class AiGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouterService: AiRouterService,
    private readonly aiLoggerService: AiLoggerService,
  ) {}

  async run(input: RunAiInput) {
    const request = this.validateRequest(input);

    try {
      const routed = await this.aiRouterService.route(request);
      const log = await this.aiLoggerService.logSuccess(
        routed.provider.id,
        request,
        routed.result,
      );

      return {
        requestId: log.id,
        providerId: routed.provider.id,
        moduleSource: log.moduleSource,
        operation: request.operation,
        outputJson: routed.result.outputJson,
        tokensUsed: routed.result.tokensUsed ?? null,
        suggestionOnly: true,
      };
    } catch (error) {
      const providerId = await this.resolveFailureProviderId(request);
      const message =
        error instanceof Error ? error.message : 'AI request failed';

      if (providerId) {
        await this.aiLoggerService.logFailure(providerId, request, message);
      }

      throw error;
    }
  }

  async configureProvider(input: UpsertAiProviderInput) {
    return this.prisma.aiProvider.create({
      data: {
        name: input.name,
        configJson: input.configJson,
        isActive: input.isActive ?? true,
      },
    });
  }

  updateProvider(
    id: string,
    input: Partial<UpsertAiProviderInput>,
  ) {
    return this.prisma.aiProvider.update({
      where: { id },
      data: {
        name: input.name,
        configJson: input.configJson,
        isActive: input.isActive,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  listProviders() {
    return this.prisma.aiProvider.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  createSession(contextJson: Prisma.InputJsonValue) {
    return this.prisma.aiSession.create({
      data: {
        contextJson,
      },
    });
  }

  updateSession(id: string, contextJson: Prisma.InputJsonValue) {
    return this.prisma.aiSession.update({
      where: { id },
      data: {
        contextJson,
      },
    });
  }

  private validateRequest(input: RunAiInput): AiGatewayRequest {
    if (!input.prompt.trim()) {
      throw new BadRequestException('AI prompt is required');
    }

    if (!this.isSupportedOperation(input.operation)) {
      throw new BadRequestException('Unsupported AI operation');
    }

    return {
      moduleSource: input.moduleSource,
      operation: input.operation,
      prompt: input.prompt,
      inputJson: input.inputJson,
      providerId: input.providerId,
      providerName: input.providerName,
      sessionId: input.sessionId,
    };
  }

  private isSupportedOperation(operation: string): operation is AiOperation {
    return [
      'text_generation',
      'classification',
      'summarization',
      'extraction',
    ].includes(operation);
  }

  private async resolveFailureProviderId(request: AiGatewayRequest) {
    if (request.providerId) {
      return request.providerId;
    }

    const provider = await this.prisma.aiProvider.findFirst({
      where: {
        name: request.providerName,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
      },
    });

    return provider?.id;
  }
}
