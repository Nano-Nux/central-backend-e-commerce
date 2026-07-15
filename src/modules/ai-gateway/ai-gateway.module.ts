import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AiGatewayService } from '../core/ai-gateway.service';
import { AiLoggerService } from '../logger/ai-logger.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAiProvider } from '../providers/openai.provider';
import { AiRouterService } from '../router/ai-router.service';
import { AiGatewayController } from './ai-gateway.controller';

@Module({
  imports: [AuthModule],
  controllers: [AiGatewayController],
  providers: [
    AiGatewayService,
    AiRouterService,
    AiLoggerService,
    OpenAiProvider,
    GeminiProvider,
  ],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}
