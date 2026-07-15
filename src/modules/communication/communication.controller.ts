import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';

import { Prisma } from '../../../generated/prisma/client';
import {
  CommunicationChannelType,
  ConversationParticipantType,
  ConversationStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ConversationsService } from '../conversations/conversations.service';
import { EmailService } from '../email/email.service';
import { MessagesService } from '../messages/messages.service';
import { EmailTemplatesService } from '../templates/email-templates.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { createPaginationMeta, normalizePagination } from '../shared/helpers/pagination.helper';

type RequestWithUser = Request & { user?: AuthenticatedUser };

class ConversationParticipantDto {
  @ApiProperty({ enum: ConversationParticipantType })
  @IsEnum(ConversationParticipantType)
  participantType!: ConversationParticipantType;

  @ApiProperty()
  @IsString()
  participantId!: string;
}

class CreateConversationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ enum: CommunicationChannelType })
  @IsEnum(CommunicationChannelType)
  channelType!: CommunicationChannelType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  externalConversationId?: string;

  @ApiPropertyOptional({ type: () => [ConversationParticipantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationParticipantDto)
  @IsOptional()
  participants?: ConversationParticipantDto[];
}

class ConversationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ enum: CommunicationChannelType })
  @IsEnum(CommunicationChannelType)
  @IsOptional()
  channelType?: CommunicationChannelType;

  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus;
}

class StoreMessageDto {
  @ApiProperty()
  @IsString()
  conversationId!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

class QueueEmailDto {
  @ApiProperty()
  @IsEmail()
  toEmail!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

class CreateEmailTemplateDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty()
  @IsString()
  body!: string;
}

class MessageQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  conversationId?: string;
}

@ApiTags('Communication')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'Support Agent')
export class CommunicationController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly emailService: EmailService,
    private readonly emailTemplatesService: EmailTemplatesService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('conversations')
  createConversation(
    @Body() dto: CreateConversationDto,
    @Req() req: RequestWithUser,
  ) {
    return this.conversationsService.createConversation(dto, this.context(req));
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('conversations')
  listConversations(@Query() query: ConversationQueryDto) {
    return this.conversationsService.listConversations(query);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('conversations/:id')
  getConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.getConversationHistory(id);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Patch('conversations/:id/close')
  closeConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.conversationsService.closeConversation(id, this.context(req));
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('messages/send')
  sendMessage(@Body() dto: StoreMessageDto, @Req() req: RequestWithUser) {
    return this.messagesService.sendMessage(
      {
        ...dto,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      this.context(req),
    );
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('messages/inbound')
  storeInboundMessage(
    @Body() dto: StoreMessageDto,
    @Req() req: RequestWithUser,
  ) {
    return this.messagesService.storeInboundMessage(
      {
        ...dto,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      this.context(req),
    );
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('messages/:conversationId')
  listMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.messagesService.listConversationMessages(conversationId);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('messages')
  async listAllMessages(@Query() query: MessageQueryDto) {
    if (query.conversationId) {
      return this.messagesService.listConversationMessages(query.conversationId);
    }
    const pagination = normalizePagination(query.page, query.limit);
    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        orderBy: { sentAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.message.count(),
    ]);
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('email/send')
  queueEmail(@Body() dto: QueueEmailDto, @Req() req: RequestWithUser) {
    return this.emailService.queueEmail(
      {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
      this.context(req),
    );
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('email/queue')
  async listEmailQueue(@Query() query: PaginationQueryDto) {
    const pagination = normalizePagination(query.page, query.limit);
    const [data, total] = await Promise.all([
      this.prisma.emailQueue.findMany({
        orderBy: { scheduledAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.emailQueue.count(),
    ]);
    return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, total) };
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('email/templates')
  createTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplatesService.createTemplate(dto);
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager, Support Agent' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('email/templates')
  listTemplates() {
    return this.emailTemplatesService.findAll();
  }

  private context(req: RequestWithUser) {
    return {
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
