import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
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
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

import { Prisma } from '../../../generated/prisma/client';
import {
  AiModuleSource,
  AiProviderName,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiGatewayService } from '../core/ai-gateway.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';

class RunAiRequestDto {
  @ApiProperty({ enum: AiModuleSource })
  @IsEnum(AiModuleSource)
  moduleSource!: AiModuleSource;

  @ApiProperty()
  @IsString()
  operation!: string;

  @ApiProperty()
  @IsString()
  prompt!: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  inputJson?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  providerId?: string;

  @ApiPropertyOptional({ enum: AiProviderName })
  @IsEnum(AiProviderName)
  @IsOptional()
  providerName?: AiProviderName;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sessionId?: string;
}

class ConfigureAiProviderDto {
  @ApiProperty({ enum: AiProviderName })
  @IsEnum(AiProviderName)
  name!: AiProviderName;

  @ApiProperty({ type: Object })
  @IsObject()
  configJson!: Record<string, unknown>;
}

class UpdateAiProviderDto {
  @ApiPropertyOptional({ enum: AiProviderName })
  @IsEnum(AiProviderName)
  @IsOptional()
  name?: AiProviderName;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  configJson?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

class AiRequestQueryDto {
  @ApiPropertyOptional({ enum: AiModuleSource })
  @IsEnum(AiModuleSource)
  @IsOptional()
  moduleSource?: AiModuleSource;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  providerId?: string;
}

class AiAnalysisDto {
  @ApiProperty()
  @IsString()
  prompt!: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  inputJson?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  providerId?: string;
}

@ApiTags('AI Gateway')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class AiGatewayController {
  constructor(
    private readonly aiGatewayService: AiGatewayService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('requests')
  run(@Body() dto: RunAiRequestDto) {
    return this.aiGatewayService.run({
      ...dto,
      operation: dto.operation as
        | 'text_generation'
        | 'classification'
        | 'summarization'
        | 'extraction',
      inputJson: dto.inputJson as Prisma.InputJsonValue | undefined,
    });
  }

  @ApiOperation({ summary: 'Run a conversational AI request through the gateway' })
  @ApiCreatedResponse({ description: 'Created successfully', type: ApiSuccessResponseDto })
  @Post('chat')
  chat(@Body() dto: AiAnalysisDto) {
    return this.aiGatewayService.run({
      moduleSource: AiModuleSource.SYSTEM,
      operation: 'text_generation',
      prompt: dto.prompt,
      inputJson: dto.inputJson as Prisma.InputJsonValue | undefined,
      providerId: dto.providerId,
    });
  }

  @ApiOperation({ summary: 'Analyze sales through the AI gateway' })
  @ApiCreatedResponse({ description: 'Created successfully', type: ApiSuccessResponseDto })
  @Post('analyze-sales')
  analyzeSales(@Body() dto: AiAnalysisDto) {
    return this.aiGatewayService.run({
      moduleSource: AiModuleSource.ORDER,
      operation: 'summarization',
      prompt: dto.prompt,
      inputJson: dto.inputJson as Prisma.InputJsonValue | undefined,
      providerId: dto.providerId,
    });
  }

  @ApiOperation({ summary: 'Analyze inventory through the AI gateway' })
  @ApiCreatedResponse({ description: 'Created successfully', type: ApiSuccessResponseDto })
  @Post('analyze-inventory')
  analyzeInventory(@Body() dto: AiAnalysisDto) {
    return this.aiGatewayService.run({
      moduleSource: AiModuleSource.SYSTEM,
      operation: 'summarization',
      prompt: dto.prompt,
      inputJson: dto.inputJson as Prisma.InputJsonValue | undefined,
      providerId: dto.providerId,
    });
  }

  @ApiOperation({ summary: 'Analyze customers through the AI gateway' })
  @ApiCreatedResponse({ description: 'Created successfully', type: ApiSuccessResponseDto })
  @Post('analyze-customers')
  analyzeCustomers(@Body() dto: AiAnalysisDto) {
    return this.aiGatewayService.run({
      moduleSource: AiModuleSource.CRM,
      operation: 'summarization',
      prompt: dto.prompt,
      inputJson: dto.inputJson as Prisma.InputJsonValue | undefined,
      providerId: dto.providerId,
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('requests')
  findRequests(@Query() query: AiRequestQueryDto) {
    return this.prisma.aiRequest.findMany({
      where: {
        moduleSource: query.moduleSource,
        providerId: query.providerId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('requests/:id')
  findRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.aiRequest.findUnique({ where: { id } });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('providers')
  configureProvider(@Body() dto: ConfigureAiProviderDto) {
    return this.aiGatewayService.configureProvider({
      ...dto,
      configJson: dto.configJson as Prisma.InputJsonValue,
    });
  }

  @ApiOperation({ summary: 'Requires roles: Admin, Manager' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('providers')
  listProviders() {
    return this.aiGatewayService.listProviders();
  }

  @ApiOperation({ summary: 'Update an AI provider through the gateway' })
  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Patch('providers/:id')
  updateProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiProviderDto,
  ) {
    return this.aiGatewayService.updateProvider(id, {
      ...dto,
      configJson: dto.configJson as Prisma.InputJsonValue | undefined,
    });
  }
}
