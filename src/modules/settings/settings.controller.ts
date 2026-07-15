import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsObject, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { Prisma } from '../../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SettingsService } from './settings.service';

class UpdateSettingDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  value!: Record<string, unknown>;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List system settings' })
  @ApiOkResponse({ description: 'Success' })
  list() {
    return this.settingsService.list();
  }

  @Patch()
  @ApiOperation({ summary: 'Update a system setting' })
  @ApiOkResponse({ description: 'Updated successfully' })
  update(@Body() dto: UpdateSettingDto, @Req() req: AuthenticatedRequest) {
    return this.settingsService.upsert(
      dto.key,
      dto.value as Prisma.InputJsonValue,
      req.user?.id,
    );
  }
}
