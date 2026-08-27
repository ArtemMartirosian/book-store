import 'reflect-metadata';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const rawTrustProxyHops = process.env.TRUST_PROXY_HOPS ?? '0';
  if (!/^(?:0|[1-9]|10)$/.test(rawTrustProxyHops)) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }
  const trustProxyHops = Number(rawTrustProxyHops);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: trustProxyHops === 0 ? false : trustProxyHops }),
    { bufferLogs: true },
  );
  const config = app.get(ConfigService);

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyRateLimit, { max: 120, timeWindow: '1 minute' });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableCors({
    origin: config
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Books Store API')
    .setDescription('Catalog, pricing, cash-on-delivery orders, administration and safe crawler controls')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-admin-api-key' }, 'admin-key')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen({
    host: config.get<string>('API_HOST', '0.0.0.0'),
    port: config.get<number>('API_PORT', 4000),
  });
}

void bootstrap();
