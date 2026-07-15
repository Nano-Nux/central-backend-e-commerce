import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { networkInterfaces } from 'node:os';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { AppConfigService } from './infrastructure/config/config.service';

function getLanUrls(port: number) {
  const interfaces = networkInterfaces();
  const lanUrls = new Set<string>();

  for (const entries of Object.values(interfaces)) {
    if (!entries) {
      continue;
    }

    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) {
        continue;
      }

      lanUrls.add(`http://${entry.address}:${port}`);
    }
  }

  return [...lanUrls].sort();
}

function logStartupUrls(logger: Logger, port: number) {
  const localhostBaseUrl = `http://localhost:${port}`;
  const lanUrls = getLanUrls(port);

  logger.log('Server is running');
  logger.log(`Local API: ${localhostBaseUrl}/api`);
  logger.log(`Local Swagger: ${localhostBaseUrl}/api/docs`);

  for (const lanUrl of lanUrls) {
    logger.log(`LAN API: ${lanUrl}/api`);
    logger.log(`LAN Swagger: ${lanUrl}/api/docs`);
  }
}

function createLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (request) => request.originalUrl.startsWith('/api/docs'),
  });
}

function buildCorsOptions(configService: AppConfigService): CorsOptions {
  const allowedOrigins = new Set(configService.getCorsOrigins());

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin is not allowed'));
    },
    credentials: true,
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.enableCors(buildCorsOptions(configService));
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1', createLimiter(60 * 1000, 100));
  app.use('/api/v1/auth/login', createLimiter(60 * 1000, 5));
  app.use('/api/v1/auth/register', createLimiter(60 * 1000, 3));
  app.use('/api/v1/auth/refresh', createLimiter(10 * 60 * 1000, 10));
  app.use('/api/v1/webhooks', createLimiter(60 * 1000, 60));
  app.use(
    '/api/v1/store/guest-orders/lookup-request',
    createLimiter(10 * 60 * 1000, 3),
  );
  app.use('/api/v1/store/guest-orders/verify', createLimiter(10 * 60 * 1000, 3));
  app.use('/api/v1/store/checkout', createLimiter(15 * 60 * 1000, 30));
  app.use(
    /^\/api\/v1\/store\/(me\/orders|guest-orders)\/.*\/(payment-proofs|line-pay)/,
    createLimiter(10 * 60 * 1000, 10),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseTransformInterceptor(),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Central Backend API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearerAuth',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = configService.getPort();

  await app.listen(port);

  logStartupUrls(logger, port);
}

void bootstrap();
