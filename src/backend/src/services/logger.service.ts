// @nestjs/common v10.0.0
import { Injectable } from '@nestjs/common';
// winston v3.10.0
import { Logger, createLogger, format, transports } from 'winston';
// Internal imports
import { appConfig } from '../config/app.config';

/**
 * Creates and configures a Winston logger instance with environment-specific settings
 * @returns {Logger} Configured Winston logger instance
 */
const createLoggerInstance = (): Logger => {
  const { environment } = appConfig;
  const isProduction = environment === 'production';

  // Define log formats
  const productionFormat = format.combine(
    format.timestamp(),
    format.uncolorize(),
    format.json(),
    format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'label']
    })
  );

  const developmentFormat = format.combine(
    format.timestamp(),
    format.colorize(),
    format.printf(({ timestamp, level, message, ...metadata }) => {
      return `[${timestamp}] ${level}: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : ''}`;
    })
  );

  // Configure transports based on environment
  const logTransports = [
    new transports.Console({
      level: isProduction ? 'info' : 'debug',
      format: isProduction ? productionFormat : developmentFormat
    })
  ];

  // Add file transport for production
  if (isProduction) {
    logTransports.push(
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true,
        zippedArchive: true
      }),
      new transports.File({
        filename: 'logs/combined.log',
        format: productionFormat,
        maxsize: 5242880,
        maxFiles: 5,
        tailable: true,
        zippedArchive: true
      })
    );
  }

  // Create logger instance with configuration
  return createLogger({
    level: isProduction ? 'info' : 'debug',
    format: isProduction ? productionFormat : developmentFormat,
    transports: logTransports,
    exitOnError: false,
    silent: process.env.NODE_ENV === 'test'
  });
};

@Injectable()
export class LoggerService {
  private readonly logger: Logger;
  private correlationId: string = '';
  private tenantId: string = '';

  constructor() {
    this.logger = createLoggerInstance();
    this.setupErrorHandler();
    this.setupCleanupTask();
  }

  /**
   * Sets up error handling for the logger instance
   */
  private setupErrorHandler(): void {
    this.logger.on('error', (error) => {
      console.error('Logger error:', error);
      // Implement error reporting to monitoring service if needed
    });
  }

  /**
   * Sets up periodic cleanup of old log files
   */
  private setupCleanupTask(): void {
    if (appConfig.environment === 'production') {
      setInterval(() => {
        // Implement log rotation and cleanup logic
      }, 86400000); // Run daily
    }
  }

  /**
   * Sets the correlation ID for request tracing
   * @param correlationId - Unique identifier for request tracing
   */
  setCorrelationId(correlationId: string): void {
    if (!correlationId || typeof correlationId !== 'string') {
      throw new Error('Invalid correlation ID');
    }
    this.correlationId = correlationId;
  }

  /**
   * Sets the tenant ID for log isolation
   * @param tenantId - Unique identifier for tenant
   */
  setTenantId(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Invalid tenant ID');
    }
    this.tenantId = tenantId;
  }

  /**
   * Sanitizes sensitive data from log messages
   * @param data - Data to be sanitized
   * @returns Sanitized data
   */
  private sanitize(data: any): any {
    if (typeof data !== 'object' || !data) {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    const sanitized = { ...data };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Logs an info level message with metadata
   * @param message - Log message
   * @param meta - Additional metadata
   */
  info(message: string, meta: Record<string, any> = {}): void {
    const sanitizedMeta = this.sanitize(meta);
    this.logger.info(message, {
      correlationId: this.correlationId,
      tenantId: this.tenantId,
      timestamp: new Date().toISOString(),
      ...sanitizedMeta
    });
  }

  /**
   * Logs an error level message with stack trace
   * @param message - Error message
   * @param error - Error object
   * @param meta - Additional metadata
   */
  error(message: string, error: Error, meta: Record<string, any> = {}): void {
    const sanitizedMeta = this.sanitize(meta);
    this.logger.error(message, {
      correlationId: this.correlationId,
      tenantId: this.tenantId,
      timestamp: new Date().toISOString(),
      stack: error.stack,
      errorName: error.name,
      errorMessage: error.message,
      ...sanitizedMeta
    });
  }

  /**
   * Logs a warning level message with metadata
   * @param message - Warning message
   * @param meta - Additional metadata
   */
  warn(message: string, meta: Record<string, any> = {}): void {
    const sanitizedMeta = this.sanitize(meta);
    this.logger.warn(message, {
      correlationId: this.correlationId,
      tenantId: this.tenantId,
      timestamp: new Date().toISOString(),
      ...sanitizedMeta
    });
  }

  /**
   * Logs a debug level message with metadata
   * @param message - Debug message
   * @param meta - Additional metadata
   */
  debug(message: string, meta: Record<string, any> = {}): void {
    if (appConfig.environment !== 'production') {
      const sanitizedMeta = this.sanitize(meta);
      this.logger.debug(message, {
        correlationId: this.correlationId,
        tenantId: this.tenantId,
        timestamp: new Date().toISOString(),
        ...sanitizedMeta
      });
    }
  }
}