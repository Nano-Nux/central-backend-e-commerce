import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  AiModuleSource,
  AiProviderName,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAiProvider } from '../providers/openai.provider';

export type AiOperation =
  | 'text_generation'
  | 'classification'
  | 'summarization'
  | 'extraction';

export type AiGatewayRequest = {
  moduleSource: AiModuleSource;
  operation: AiOperation;
  prompt: string;
  inputJson?: Prisma.InputJsonValue;
  providerId?: string;
  providerName?: AiProviderName;
  sessionId?: string;
};

export type AiProviderResult = {
  outputJson: Prisma.InputJsonValue;
  tokensUsed?: number;
};

export type AiProviderAdapter = {
  generate(
    provider: {
      id: string;
      name: AiProviderName;
      configJson: Prisma.JsonValue;
    },
    request: AiGatewayRequest,
  ): Promise<AiProviderResult>;
};

@Injectable()
export class AiRouterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  async route(request: AiGatewayRequest) {
    const provider = await this.resolveProvider(request);
    const adapter = this.getAdapter(provider.name);

    return {
      provider,
      result: await adapter.generate(provider, request),
    };
  }

  private async resolveProvider(request: AiGatewayRequest) {
    const provider = await this.prisma.aiProvider.findFirst({
      where: {
        id: request.providerId,
        name: request.providerName,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!provider) {
      throw new BadRequestException('Active AI provider is not configured');
    }

    return provider;
  }

  private getAdapter(providerName: AiProviderName): AiProviderAdapter {
    switch (providerName) {
      case AiProviderName.OPENAI:
        return this.openAiProvider;
      case AiProviderName.GEMINI:
        return this.geminiProvider;
      case AiProviderName.LOCAL:
      case AiProviderName.OTHER:
        throw new BadRequestException('AI provider adapter is not configured');
      default:
        throw new BadRequestException('Unsupported AI provider');
    }
  }
}
