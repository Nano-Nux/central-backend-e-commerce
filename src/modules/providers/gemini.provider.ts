import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import {
  AiGatewayRequest,
  AiProviderAdapter,
  AiProviderResult,
} from '../router/ai-router.service';

type GeminiConfig = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

@Injectable()
export class GeminiProvider implements AiProviderAdapter {
  async generate(
    provider: { configJson: Prisma.JsonValue },
    request: AiGatewayRequest,
  ): Promise<AiProviderResult> {
    const config = this.parseConfig(provider.configJson);

    if (!config.apiKey || !config.model) {
      throw new BadRequestException('Gemini provider config is incomplete');
    }

    const baseUrl =
      config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    const response = await fetch(
      `${baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: this.buildPrompt(request),
                },
              ],
            },
          ],
        }),
      },
    );

    const body = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new BadRequestException('Gemini request failed');
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
    const candidates = body.candidates;

    if (!Array.isArray(candidates)) {
      return JSON.stringify(body);
    }

    const first = candidates[0] as Record<string, unknown> | undefined;
    const content = first?.content as Record<string, unknown> | undefined;
    const parts = content?.parts;

    if (!Array.isArray(parts)) {
      return JSON.stringify(body);
    }

    return parts
      .map((part) =>
        typeof part === 'object' &&
        part !== null &&
        'text' in part &&
        typeof part.text === 'string'
          ? part.text
          : '',
      )
      .join('');
  }

  private extractTokens(body: Record<string, unknown>) {
    const usageMetadata = body.usageMetadata;

    if (
      typeof usageMetadata === 'object' &&
      usageMetadata !== null &&
      'totalTokenCount' in usageMetadata &&
      typeof usageMetadata.totalTokenCount === 'number'
    ) {
      return usageMetadata.totalTokenCount;
    }

    return undefined;
  }

  private parseConfig(configJson: Prisma.JsonValue): GeminiConfig {
    return typeof configJson === 'object' && configJson !== null
      ? (configJson as GeminiConfig)
      : {};
  }
}
