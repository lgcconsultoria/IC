import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // limite maior p/ aceitar fotos (base64) no endpoint de análise de refeição
  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.enableCors({ origin: process.env.NEXT_PUBLIC_API_URL ?? true });

  const config = new DocumentBuilder()
    .setTitle('IC API')
    .setDescription('API da plataforma da Clínica IC')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Hosts persistentes (Railway/Render/Fly) injetam PORT; local usa API_PORT.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`IC API rodando em http://localhost:${port}/api`);
}

void bootstrap();
