import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { databaseConfig } from '../../src/config/database.config';

export class InitialMigration implements MigrationInterface {
    private readonly tablePrefix = 'codequest_';
    private readonly auditRetentionDays = 365;

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create companies table
        await queryRunner.createTable(new Table({
            name: `${this.tablePrefix}companies`,
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'subscription_tier',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'point_config',
                    type: 'jsonb',
                    isNullable: false,
                    comment: 'Encrypted point configuration settings',
                },
                {
                    name: 'created_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updated_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);

        // Create organizations table
        await queryRunner.createTable(new Table({
            name: `${this.tablePrefix}organizations`,
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'company_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'point_overrides',
                    type: 'jsonb',
                    isNullable: true,
                    comment: 'Encrypted organization-specific point overrides',
                },
                {
                    name: 'created_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updated_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
            foreignKeys: [
                {
                    columnNames: ['company_id'],
                    referencedTableName: `${this.tablePrefix}companies`,
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);

        // Create users table
        await queryRunner.createTable(new Table({
            name: `${this.tablePrefix}users`,
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'email',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                    isUnique: true,
                },
                {
                    name: 'role',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'sso_data',
                    type: 'jsonb',
                    isNullable: true,
                    comment: 'Encrypted SSO authentication data',
                },
                {
                    name: 'created_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updated_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);

        // Create teams table
        await queryRunner.createTable(new Table({
            name: `${this.tablePrefix}teams`,
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'organization_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'created_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updated_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
            foreignKeys: [
                {
                    columnNames: ['organization_id'],
                    referencedTableName: `${this.tablePrefix}organizations`,
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);

        // Create team_members table
        await queryRunner.createTable(new Table({
            name: `${this.tablePrefix}team_members`,
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'team_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'user_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'total_points',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'current_level',
                    type: 'integer',
                    default: 1,
                },
                {
                    name: 'joined_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
            foreignKeys: [
                {
                    columnNames: ['team_id'],
                    referencedTableName: `${this.tablePrefix}teams`,
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
                {
                    columnNames: ['user_id'],
                    referencedTableName: `${this.tablePrefix}users`,
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);

        // Create audit_logs table with partitioning
        await queryRunner.createTable(new Table({
            name: `${this.tablePrefix}audit_logs`,
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'company_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'user_id',
                    type: 'uuid',
                    isNullable: true,
                },
                {
                    name: 'action',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
                {
                    name: 'entity_type',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'entity_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'changes',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'created_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);

        // Create indexes
        await queryRunner.createIndices(`${this.tablePrefix}companies`, [
            new TableIndex({
                name: `idx_${this.tablePrefix}companies_subscription`,
                columnNames: ['subscription_tier'],
            }),
        ]);

        await queryRunner.createIndices(`${this.tablePrefix}organizations`, [
            new TableIndex({
                name: `idx_${this.tablePrefix}organizations_company`,
                columnNames: ['company_id'],
            }),
        ]);

        await queryRunner.createIndices(`${this.tablePrefix}users`, [
            new TableIndex({
                name: `idx_${this.tablePrefix}users_email`,
                columnNames: ['email'],
                isUnique: true,
            }),
            new TableIndex({
                name: `idx_${this.tablePrefix}users_role`,
                columnNames: ['role'],
            }),
        ]);

        await queryRunner.createIndices(`${this.tablePrefix}team_members`, [
            new TableIndex({
                name: `idx_${this.tablePrefix}team_members_points`,
                columnNames: ['team_id', 'total_points'],
            }),
            new TableIndex({
                name: `idx_${this.tablePrefix}team_members_user`,
                columnNames: ['user_id'],
            }),
        ]);

        await queryRunner.createIndices(`${this.tablePrefix}audit_logs`, [
            new TableIndex({
                name: `idx_${this.tablePrefix}audit_logs_company`,
                columnNames: ['company_id', 'created_at'],
            }),
            new TableIndex({
                name: `idx_${this.tablePrefix}audit_logs_entity`,
                columnNames: ['entity_type', 'entity_id'],
            }),
        ]);

        // Set up row-level security policies
        await queryRunner.query(`
            ALTER TABLE ${this.tablePrefix}companies ENABLE ROW LEVEL SECURITY;
            ALTER TABLE ${this.tablePrefix}organizations ENABLE ROW LEVEL SECURITY;
            ALTER TABLE ${this.tablePrefix}teams ENABLE ROW LEVEL SECURITY;
            ALTER TABLE ${this.tablePrefix}team_members ENABLE ROW LEVEL SECURITY;
            ALTER TABLE ${this.tablePrefix}audit_logs ENABLE ROW LEVEL SECURITY;
        `);

        // Create update triggers for timestamp management
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // Apply update triggers
        const timestampTables = ['companies', 'organizations', 'users', 'teams'];
        for (const table of timestampTables) {
            await queryRunner.query(`
                CREATE TRIGGER update_timestamp_trigger
                BEFORE UPDATE ON ${this.tablePrefix}${table}
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
            `);
        }

        // Set up audit log partitioning
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION create_audit_log_partition()
            RETURNS trigger AS $$
            DECLARE
                partition_date text;
                partition_name text;
            BEGIN
                partition_date := to_char(NEW.created_at, 'YYYY_MM');
                partition_name := '${this.tablePrefix}audit_logs_' || partition_date;
                
                IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
                    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF ${this.tablePrefix}audit_logs
                        FOR VALUES FROM (%L) TO (%L)',
                        partition_name,
                        date_trunc('month', NEW.created_at),
                        date_trunc('month', NEW.created_at) + interval '1 month'
                    );
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER create_audit_partition_trigger
            BEFORE INSERT ON ${this.tablePrefix}audit_logs
            FOR EACH ROW
            EXECUTE FUNCTION create_audit_log_partition();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop triggers
        const timestampTables = ['companies', 'organizations', 'users', 'teams'];
        for (const table of timestampTables) {
            await queryRunner.query(`DROP TRIGGER IF EXISTS update_timestamp_trigger ON ${this.tablePrefix}${table}`);
        }

        // Drop functions
        await queryRunner.query('DROP FUNCTION IF EXISTS update_timestamp()');
        await queryRunner.query('DROP FUNCTION IF EXISTS create_audit_log_partition()');

        // Drop tables in reverse order
        await queryRunner.dropTable(`${this.tablePrefix}audit_logs`, true);
        await queryRunner.dropTable(`${this.tablePrefix}team_members`, true);
        await queryRunner.dropTable(`${this.tablePrefix}teams`, true);
        await queryRunner.dropTable(`${this.tablePrefix}users`, true);
        await queryRunner.dropTable(`${this.tablePrefix}organizations`, true);
        await queryRunner.dropTable(`${this.tablePrefix}companies`, true);
    }
}