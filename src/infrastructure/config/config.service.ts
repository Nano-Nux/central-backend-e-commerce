import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

type Environment = Record<string, string | undefined>;

const REQUIRED_ENV_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REFRESH_SECRET',
  'APP_CURRENCY',
] as const;

const ADMIN_ENV_KEYS = [
  'ADMIN_NAME',
  'ADMIN_USERNAME',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
] as const;

export function validateEnv(config: Environment) {
  for (const key of REQUIRED_ENV_KEYS) {
    if (!config[key]?.trim()) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const port = config.APP_PORT ?? config.PORT;

  if (port && !Number.isInteger(Number(port))) {
    throw new Error('APP_PORT must be a valid integer');
  }

  if (config.APP_CURRENCY && !/^[A-Z]{3}$/.test(config.APP_CURRENCY)) {
    throw new Error('APP_CURRENCY must be a 3-letter ISO currency code');
  }

  if (config.NODE_ENV === 'production') {
    for (const key of ['JWT_SECRET', 'REFRESH_SECRET']) {
      const value = config[key]?.trim();

      if (!value || value.length < 32) {
        throw new Error(`${key} must be at least 32 characters in production`);
      }

      if (['change-me', 'change-me-refresh'].includes(value)) {
        throw new Error(`${key} must not use the sample value in production`);
      }
    }
  }

  if (
    config.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL &&
    !isBooleanString(config.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL)
  ) {
    throw new Error(
      'DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL must be true or false',
    );
  }

  validateAdminBootstrapEnv(config);
  validateCorsOrigins(config);
  validateWebhookSecrets(config);

  return config;
}

function isBooleanString(value: string) {
  return ['true', 'false'].includes(value.trim().toLowerCase());
}

function validateAdminBootstrapEnv(config: Environment) {
  const hasAdminConfig = ADMIN_ENV_KEYS.some((key) => config[key]?.trim());

  if (!hasAdminConfig) {
    return;
  }

  const adminName = config.ADMIN_NAME?.trim() ?? config.ADMIN_USERNAME?.trim();

  if (!adminName || !config.ADMIN_EMAIL?.trim() || !config.ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_NAME or ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be set together',
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.ADMIN_EMAIL)) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }

  const strongPassword =
    config.ADMIN_PASSWORD.length >= 8 &&
    /[a-z]/.test(config.ADMIN_PASSWORD) &&
    /[A-Z]/.test(config.ADMIN_PASSWORD) &&
    /\d/.test(config.ADMIN_PASSWORD) &&
    /[^A-Za-z\d]/.test(config.ADMIN_PASSWORD);

  if (!strongPassword) {
    throw new Error(
      'ADMIN_PASSWORD must be at least 8 characters and include uppercase, lowercase, number, and special character',
    );
  }

  if (
    config.NODE_ENV === 'production' &&
    config.ADMIN_PASSWORD === 'Admin@12345'
  ) {
    throw new Error(
      'ADMIN_PASSWORD must not use the sample value in production',
    );
  }
}

function validateCorsOrigins(config: Environment) {
  const corsOrigins = config.APP_CORS_ORIGINS?.trim();

  if (!corsOrigins) {
    return;
  }

  for (const origin of corsOrigins.split(',')) {
    const normalized = origin.trim();

    if (!normalized) {
      continue;
    }

    try {
      const parsed = new URL(normalized);

      if (!parsed.protocol.startsWith('http')) {
        throw new Error('unsupported protocol');
      }
    } catch {
      throw new Error(
        `APP_CORS_ORIGINS contains an invalid origin: ${normalized}`,
      );
    }
  }
}

function validateWebhookSecrets(config: Environment) {
  if (config.NODE_ENV !== 'production') return;

  for (const provider of [
    'LINE',
    'TELEGRAM',
    'DISCORD',
    'FACEBOOK',
    'INSTAGRAM',
    'TIKTOK',
  ]) {
    const value = config[`WEBHOOK_${provider}_SECRET`]?.trim();
    if (value && value.length < 16) {
      throw new Error(`WEBHOOK_${provider}_SECRET must be at least 16 characters in production`);
    }
  }
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: NestConfigService) {}

  getOptionalString(key: string) {
    const value = this.configService.get<string>(key);
    const normalized = value?.trim();

    return normalized ? normalized : null;
  }

  getCurrency() {
    return this.configService.getOrThrow<string>('APP_CURRENCY');
  }

  getPort() {
    return Number(
        this.configService.get<string>('APP_PORT') ??
        this.configService.get<string>('PORT') ??
        3001,
    );
  }

  isProduction() {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  getApiBaseUrl() {
    return (
      this.getOptionalString('APP_BASE_URL') ??
      `http://localhost:${this.getPort()}/api/v1`
    );
  }

  getLinePayChannelId() {
    return this.getOptionalString('LINE_PAY_CHANNEL_ID');
  }

  getLinePayChannelSecret() {
    return this.getOptionalString('LINE_PAY_CHANNEL_SECRET');
  }

  getWebhookSecret(provider: string) {
    const key = `WEBHOOK_${provider.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}_SECRET`;
    return this.getOptionalString(key);
  }

  getWebhookPublicKey(provider: string) {
    const key = `WEBHOOK_${provider.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}_PUBLIC_KEY`;
    return this.getOptionalString(key);
  }

  isLinePayEnabled() {
    return Boolean(
      this.getLinePayChannelId() && this.getLinePayChannelSecret(),
    );
  }

  getCorsOrigins() {
    const configured = this.getOptionalString('APP_CORS_ORIGINS');

    if (!configured) {
      return this.isProduction()
        ? []
        : ['http://localhost:3000', 'http://127.0.0.1:3000'];
    }

    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}
