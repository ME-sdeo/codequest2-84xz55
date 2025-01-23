// @nestjs/config v10.0.0
import { ConfigService } from '@nestjs/config';
// @nestjs/typeorm v10.0.0
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseConfig } from '../interfaces/config.interface';
import { join } from 'path';

// Default configuration values
const DEFAULT_DB_PORT = 5432;
const DEFAULT_DB_SYNC = false;
const DEFAULT_DB_SSL = true;
const DEFAULT_POOL_SIZE = 10;
const DEFAULT_TIMEOUT = 30000;

/**
 * Factory function to generate comprehensive database configuration
 * Implements multi-tenant support, replication, security, and performance optimizations
 */
export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const environment = configService.get<string>('NODE_ENV', 'development');
  const isProduction = environment === 'production';

  // Base configuration
  const baseConfig: Partial<DatabaseConfig> = {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', DEFAULT_DB_PORT),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
    schema: configService.get<string>('DB_SCHEMA', 'public'),
    synchronize: configService.get<boolean>('DB_SYNC', DEFAULT_DB_SYNC),
    tenantIdentifier: 'company_id',
  };

  // SSL Configuration with certificate validation
  const sslConfig = {
    ssl: isProduction ? {
      rejectUnauthorized: true,
      ca: configService.get<string>('DB_SSL_CA'),
      key: configService.get<string>('DB_SSL_KEY'),
      cert: configService.get<string>('DB_SSL_CERT'),
    } : DEFAULT_DB_SSL,
  };

  // Connection pool and timeout settings
  const connectionConfig = {
    poolSize: configService.get<number>('DB_POOL_SIZE', DEFAULT_POOL_SIZE),
    connectTimeoutMS: configService.get<number>('DB_TIMEOUT', DEFAULT_TIMEOUT),
    maxQueryExecutionTime: 1000, // Log slow queries
    extra: {
      max: configService.get<number>('DB_MAX_CONNECTIONS', 100),
      idleTimeoutMillis: 60000,
      statement_timeout: 30000,
    },
  };

  // Replication configuration for production
  const replicationConfig = isProduction ? {
    replication: {
      master: {
        host: configService.get<string>('DB_MASTER_HOST'),
        port: configService.get<number>('DB_MASTER_PORT', DEFAULT_DB_PORT),
        username: configService.get<string>('DB_MASTER_USERNAME'),
        password: configService.get<string>('DB_MASTER_PASSWORD'),
      },
      slaves: [
        {
          host: configService.get<string>('DB_SLAVE1_HOST'),
          port: configService.get<number>('DB_SLAVE1_PORT', DEFAULT_DB_PORT),
          username: configService.get<string>('DB_SLAVE1_USERNAME'),
          password: configService.get<string>('DB_SLAVE1_PASSWORD'),
        },
        {
          host: configService.get<string>('DB_SLAVE2_HOST'),
          port: configService.get<number>('DB_SLAVE2_PORT', DEFAULT_DB_PORT),
          username: configService.get<string>('DB_SLAVE2_USERNAME'),
          password: configService.get<string>('DB_SLAVE2_PASSWORD'),
        },
      ],
    },
  } : {};

  // Entity and migration paths
  const pathConfig = {
    entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
    migrations: [join(__dirname, '../migrations/*{.ts,.js}')],
    migrationsRun: true,
    migrationsTableName: 'migrations',
  };

  // Logging configuration
  const loggingConfig = {
    logging: isProduction ? ['error', 'warn', 'migration'] : 'all',
    logger: 'advanced-console',
  };

  // Performance optimizations
  const performanceConfig = {
    cache: {
      duration: 60000, // 1 minute cache
      type: 'redis',
      options: {
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
      },
    },
    extra: {
      // PostgreSQL specific optimizations
      application_name: 'codequest',
      idle_in_transaction_session_timeout: 60000,
      lock_timeout: 60000,
    },
  };

  // Combine all configurations
  return {
    ...baseConfig,
    ...sslConfig,
    ...connectionConfig,
    ...replicationConfig,
    ...pathConfig,
    ...loggingConfig,
    ...performanceConfig,
    // Multi-tenant schema configuration
    entityPrefix: configService.get<string>('DB_ENTITY_PREFIX', ''),
    namingStrategy: {
      type: 'custom-naming-strategy',
      schemaPrefix: configService.get<string>('DB_SCHEMA_PREFIX', ''),
    },
  } as TypeOrmModuleOptions;
};

// Export the database configuration factory
export const databaseConfig = {
  provide: 'DATABASE_CONFIG',
  useFactory: getDatabaseConfig,
  inject: [ConfigService],
};