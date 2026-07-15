import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.systemSetting.findMany({ orderBy: { settingKey: 'asc' } });
  }

  upsert(key: string, value: Prisma.InputJsonValue, userId?: string) {
    return this.prisma.systemSetting.upsert({
      where: { settingKey: key },
      create: { settingKey: key, valueJson: value, updatedByUserId: userId },
      update: { valueJson: value, updatedByUserId: userId },
    });
  }
}
