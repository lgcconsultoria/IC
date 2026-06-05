import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import type { Request, Response } from 'express';
// Importa o app já COMPILADO pelo `nest build` (tsc preserva os metadados de
// decorators, essenciais para a injeção de dependência do Nest).
import { AppModule } from '../dist/app.module.js';

// Na Vercel a função recebe (req, res) no estilo Node/Express, então o próprio
// app Express do Nest pode ser invocado diretamente — sem adaptador de Lambda.
let appPromise: Promise<express.Express> | null = null;

async function getApp(): Promise<express.Express> {
  const expressApp = express();
  const nest = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn'] },
  );
  nest.setGlobalPrefix('api');
  nest.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  nest.enableCors({ origin: true });
  await nest.init();
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  if (!appPromise) appPromise = getApp();
  const app = await appPromise;
  return app(req, res);
}
