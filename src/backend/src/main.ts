/**
 * @fileoverview Entry point for the CodeQuest NestJS backend application
 * Implements comprehensive server configuration with enhanced security,
 * monitoring, and production-ready features.
 * @version 1.0.0
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { ValidationPipe as CustomValidationPipe } from './pipes/validation.pipe';
import { LoggerService } from './services/logger.service';

/**
 * Bootstraps the NestJS application with comprehensive production configuration
 */
async function bootstrap(): Promise<void> {
  // Initialize custom logger
  const logger = new LoggerService();
  logger.setContext('Bootstrap');

  try {
    // Create NestJS application with custom logger
    const app = await NestFactory.create(AppModule, {
      logger,
      cors: false, // We'll configure CORS manually
      bodyParser: true,
    });

    // Configure security middleware
    app.use(helmet({
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: true,
      dnsPrefetchControl: true,
      frameguard: true,
      hidePoweredBy: true,
      hsts: true,
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: true,
      xssFilter: true,
    }));

    // Enable compression
    app.use(compression());

    // Configure CORS with strict options
    app.enableCors(appConfig.corsOptions);

    // Configure global validation pipe
    app.useGlobalPipes(
      new CustomValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: process.env.NODE_ENV === 'production',
      })
    );

    // Configure API versioning
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
      defaultVersion: '1',
    });

    // Configure global prefix
    app.setGlobalPrefix(appConfig.apiPrefix);

    // Configure WebSocket adapter for real-time updates
    app.useWebSocketAdapter(new WsAdapter(app));

    // Configure Swagger documentation
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('CodeQuest API')
        .setDescription('CodeQuest gamification platform API documentation')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    }

    // Configure health checks
    await app.get(TerminusModule);

    // Configure metrics collection
    await app.get(PrometheusModule);

    // Configure graceful shutdown
    app.enableShutdownHooks();
    await handleShutdown(app);

    // Start server
    const port = appConfig.port || 3000;
    await app.listen(port);

    logger.info(`Application started successfully`, {
      port,
      environment: process.env.NODE_ENV,
      apiPrefix: appConfig.apiPrefix,
    });

  } catch (error) {
    logger.error('Failed to start application', error as Error);
    process.exit(1);
  }
}

/**
 * Configures graceful shutdown handling
 * @param app NestJS application instance
 */
async function handleShutdown(app: any): Promise<void> {
  const logger = new LoggerService();
  logger.setContext('Shutdown');

  const signals = ['SIGTERM', 'SIGINT'];
  const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      // Start shutdown timeout
      const timeoutId = setTimeout(() => {
        logger.error('Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT);

      try {
        // Stop accepting new requests
        await app.close();
        logger.info('Application shutdown completed successfully');
        clearTimeout(timeoutId);
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error as Error);
        clearTimeout(timeoutId);
        process.exit(1);
      }
    });
  }
}

// Start the application
bootstrap();