import { BadRequestException, Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Prisma } from '../../../generated/prisma/client';
import { WebhooksService } from './webhooks.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @ApiOperation({ summary: 'Receive a normalized channel webhook' })
  @ApiAcceptedResponse({ description: 'Webhook accepted' })
  @Post('line')
  receiveLine(@Headers('x-event-id') eventHeader: string | undefined, @Body() payload: Record<string, unknown>, @Req() request: RawBodyRequest) {
    return this.receive('line', eventHeader, payload, request);
  }

  @Post('telegram')
  receiveTelegram(@Headers('x-event-id') eventHeader: string | undefined, @Body() payload: Record<string, unknown>, @Req() request: RawBodyRequest) {
    return this.receive('telegram', eventHeader, payload, request);
  }

  @Post('discord')
  receiveDiscord(@Headers('x-event-id') eventHeader: string | undefined, @Body() payload: Record<string, unknown>, @Req() request: RawBodyRequest) {
    return this.receive('discord', eventHeader, payload, request);
  }

  @Post('facebook')
  receiveFacebook(@Headers('x-event-id') eventHeader: string | undefined, @Body() payload: Record<string, unknown>, @Req() request: RawBodyRequest) {
    return this.receive('facebook', eventHeader, payload, request);
  }

  @Post('instagram')
  receiveInstagram(@Headers('x-event-id') eventHeader: string | undefined, @Body() payload: Record<string, unknown>, @Req() request: RawBodyRequest) {
    return this.receive('instagram', eventHeader, payload, request);
  }

  @Post('tiktok')
  receiveTiktok(@Headers('x-event-id') eventHeader: string | undefined, @Body() payload: Record<string, unknown>, @Req() request: RawBodyRequest) {
    return this.receive('tiktok', eventHeader, payload, request);
  }

  private receive(
    provider: string,
    eventHeader: string | undefined,
    payload: Record<string, unknown>,
    request: RawBodyRequest,
  ) {
    const normalizedProvider = provider.trim().toLowerCase();
    const externalId = (eventHeader ?? payload.event_id ?? payload.eventId ?? payload.id ?? '').toString().trim();
    if (!externalId) {
      throw new BadRequestException('x-event-id or a provider event id is required');
    }
    return this.webhooksService.receive(
      normalizedProvider,
      externalId,
      payload as Prisma.InputJsonValue,
      request.rawBody,
      request.headers,
    );
  }
}
