import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { AiRequestStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  AiGatewayRequest,
  AiProviderResult,
} from '../router/ai-router.service';

@Injectable()
export class AiLoggerService {
  constructor(private readonly prisma: PrismaService) {}

  logSuccess(
    providerId: string,
    request: AiGatewayRequest,
    result: AiProviderResult,
  ) {
    return this.prisma.aiRequest.create({
      data: {
        providerId,
        moduleSource: request.moduleSource,
        inputJson: this.requestSnapshot(request),
        outputJson: result.outputJson,
        tokensUsed: result.tokensUsed,
        status: AiRequestStatus.SUCCESS,
      },
    });
  }

  logFailure(
    providerId: string,
    request: AiGatewayRequest,
    errorMessage: string,
  ) {
    return this.prisma.aiRequest.create({
      data: {
        providerId,
        moduleSource: request.moduleSource,
        inputJson: this.requestSnapshot(request),
        outputJson: {
          error: errorMessage,
        },
        status: AiRequestStatus.FAILED,
      },
    });
  }

  private requestSnapshot(request: AiGatewayRequest): Prisma.InputJsonValue {
    return {
      moduleSource: request.moduleSource,
      operation: request.operation,
      prompt: request.prompt,
      inputJson: request.inputJson ?? {},
      providerId: request.providerId ?? null,
      providerName: request.providerName ?? null,
      sessionId: request.sessionId ?? null,
    };
  }
}
