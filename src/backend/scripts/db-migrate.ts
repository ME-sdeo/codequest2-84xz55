// typeorm v0.3.0
import { DataSource } from 'typeorm';
// dotenv v16.0.0
import { config } from 'dotenv';
// winston v3.8.0
import { createLogger, format, transports } from 'winston';
// retry v0.13.0
import retry from 'retry';

// Internal imports
import { databaseConfig } from '../src/config/database.config';
import InitialMigration from '../migrations/1_init';
import AddActivityTablesMigration from '../migrations/2_add_activity_tables';

// Constants for configuration and timeouts
const MIGRATION_TIMEOUT = 60000;
const CONNECTION_RETRY_OPTIONS = {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 5000
};
const TRANSACTION_TIMEOUT = 30000;
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;

// Configure logger
const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            )
        })
    ]
});

/**
 * Validates database configuration and environment variables
 */
function validateConfig(config: any): boolean {
    const requiredEnvVars = [
        'DB_HOST',
        'DB_PORT',
        'DB_USERNAME',
        'DB_PASSWORD',
        'DB_NAME',
        'DB_SCHEMA'
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            logger.error(`Missing required environment variable: ${envVar}`);
            return false;
        }
    }

    if (!config.type || config.type !== 'postgres') {
        logger.error('Invalid database type: Only PostgreSQL is supported');
        return false;
    }

    return true;
}

/**
 * Initializes TypeORM DataSource with retry logic and enhanced error handling
 */
async function initializeDataSource(): Promise<DataSource> {
    // Load environment variables
    config();

    if (!validateConfig(databaseConfig)) {
        throw new Error('Invalid database configuration');
    }

    const dataSource = new DataSource({
        type: databaseConfig.type,
        host: databaseConfig.host,
        port: databaseConfig.port,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: databaseConfig.database,
        schema: process.env.DB_SCHEMA || 'public',
        ssl: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: true,
            ca: process.env.DB_SSL_CA,
        } : false,
        logging: true,
        logger: 'advanced-console',
        maxQueryExecutionTime: 1000,
        entities: [],
        migrations: [InitialMigration, AddActivityTablesMigration],
        migrationsTableName: 'migrations_history'
    });

    const operation = retry.operation(CONNECTION_RETRY_OPTIONS);

    return new Promise((resolve, reject) => {
        operation.attempt(async (currentAttempt) => {
            try {
                logger.info(`Attempting database connection (attempt ${currentAttempt})`);
                await dataSource.initialize();
                logger.info('Database connection established successfully');
                resolve(dataSource);
            } catch (error) {
                if (operation.retry(error as Error)) {
                    logger.warn(`Failed to connect to database. Retrying... (${error.message})`);
                    return;
                }
                reject(operation.mainError());
            }
        });
    });
}

/**
 * Executes database migrations with comprehensive error handling and progress tracking
 */
async function runMigrations(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();
    let migrationTimeout: NodeJS.Timeout;

    try {
        logger.info('Starting database migration process');

        // Set up migration timeout
        const timeoutPromise = new Promise((_, reject) => {
            migrationTimeout = setTimeout(() => {
                reject(new Error(`Migration timed out after ${MIGRATION_TIMEOUT}ms`));
            }, MIGRATION_TIMEOUT);
        });

        // Begin transaction
        await queryRunner.startTransaction();
        logger.info('Transaction started');

        // Run migrations with timeout
        const migrationPromise = dataSource.runMigrations({
            transaction: 'each'
        });

        await Promise.race([migrationPromise, timeoutPromise]);
        clearTimeout(migrationTimeout);

        // Commit transaction
        await queryRunner.commitTransaction();
        logger.info('Migrations completed successfully');

        // Verify migration results
        const migrations = await dataSource.showMigrations();
        if (migrations.length > 0) {
            logger.warn('Some migrations were not applied:', migrations);
        }

    } catch (error) {
        logger.error('Migration failed:', error);
        
        // Attempt to rollback transaction
        try {
            await queryRunner.rollbackTransaction();
            logger.info('Transaction rolled back successfully');
        } catch (rollbackError) {
            logger.error('Failed to rollback transaction:', rollbackError);
        }

        throw error;
    } finally {
        clearTimeout(migrationTimeout);
        await queryRunner.release();
    }
}

/**
 * Main migration execution function
 */
async function main() {
    let dataSource: DataSource | null = null;

    try {
        dataSource = await initializeDataSource();
        await runMigrations(dataSource);
        logger.info('Migration process completed successfully');
        process.exit(EXIT_SUCCESS);
    } catch (error) {
        logger.error('Migration process failed:', error);
        process.exit(EXIT_ERROR);
    } finally {
        if (dataSource?.isInitialized) {
            await dataSource.destroy();
            logger.info('Database connection closed');
        }
    }
}

// Execute migrations
if (require.main === module) {
    main();
}

export { initializeDataSource, runMigrations };