import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  AiGatewayRequest,
  AiProviderAdapter,
  AiProviderResult,
} from '../router/ai-router.service';

type OpenAiConfig = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

@Injectable()
export class OpenAiProvider implements AiProviderAdapter {
  async generate(
    provider: { configJson: Prisma.JsonValue },
    request: AiGatewayRequest,
  ): Promise<AiProviderResult> {
    const config = this.parseConfig(provider.configJson);

    if (!config.apiKey || !config.model) {
      throw new BadRequestException('OpenAI provider config is incomplete');
    }

    const response = await fetch(
      `${config.baseUrl ?? 'https://api.openai.com/v1'}/responses`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          input: this.buildPrompt(request),
        }),
      },
    );

    const body = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new BadRequestException('OpenAI request failed');
    }

    return {
      outputJson: {
        suggestion: this.extractText(body),
        raw: body as Prisma.InputJsonValue,
      },
      tokensUsed: this.extractTokens(body),
    };
  }

  private buildPrompt(request: AiGatewayRequest) {
    return [
      `Operation: ${request.operation}`,
      request.prompt,
      request.inputJson
        ? `Input JSON: ${JSON.stringify(request.inputJson)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private extractText(body: Record<string, unknown>) {
    if (typeof body.output_text === 'string') {
      return body.output_text;
    }

    return JSON.stringify(body);
  }

  private extractTokens(body: Record<string, unknown>) {
    const usage = body.usage;

    if (
      typeof usage === 'object' &&
      usage !== null &&
      'total_tokens' in usage &&
      typeof usage.total_tokens === 'number'
    ) {
      return usage.total_tokens;
    }

    return undefined;
  }

  private parseConfig(configJson: Prisma.JsonValue): OpenAiConfig {
    return typeof configJson === 'object' && configJson !== null
      ? (configJson as OpenAiConfig)
      : {};
  }
}
