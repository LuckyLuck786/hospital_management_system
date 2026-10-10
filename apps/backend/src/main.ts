import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  // rawBody: true exposes req.rawBody so Razorpay webhook signatures can be
  // verified against the exact bytes that were posted.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // We run behind a reverse proxy (Vercel → Railway). Trust the first hop so
  // req.ip and express-rate-limit read the real client from X-Forwarded-For
  // instead of logging a misconfiguration warning and bucketing everyone as one IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      message: 'Too many requests from this IP, please try again later.',
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaClientExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('MedCore HMS API')
    .setDescription('Hospital Management System API Documentation')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Hospitals', 'Hospital management')
    .addTag('Departments', 'Department management')
    .addTag('Doctors', 'Doctor profiles and schedules')
    .addTag('Appointments', 'Appointment scheduling')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 MedCore HMS API running on port ${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
