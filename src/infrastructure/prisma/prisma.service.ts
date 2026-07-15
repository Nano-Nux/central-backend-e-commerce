import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { PrismaClient } from '../../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
    const connectionUrl = withMariaDbConnectionOptions(databaseUrl, {
      allowPublicKeyRetrieval: parseBooleanEnv(
        configService.get<string>('DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL'),
      ),
    });

    super({
      adapter: new PrismaMariaDb(connectionUrl),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

function withMariaDbConnectionOptions(
  databaseUrl: string,
  options: {
    allowPublicKeyRetrieval?: boolean;
  },
) {
  if (options.allowPublicKeyRetrieval === undefined) {
    return databaseUrl;
  }

  const url = new URL(databaseUrl);
  url.searchParams.set(
    'allowPublicKeyRetrieval',
    String(options.allowPublicKeyRetrieval),
  );

  return url.toString();
}

function parseBooleanEnv(value?: string) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return undefined;
}
