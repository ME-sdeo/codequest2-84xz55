import { MigrationInterface, QueryRunner } from 'typeorm';
import { databaseConfig } from '../../src/config/database.config';

/**
 * Migration to create activity tracking tables with support for AI detection
 * and point calculations based on activity type
 */
export class AddActivityTablesMigration implements MigrationInterface {
    private readonly tablePrefix = 'codequest_';
    private readonly schema = databaseConfig.schema || 'public';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create activity type enum
        await queryRunner.query(`
            CREATE TYPE ${this.schema}.activity_type AS ENUM (
                'CODE_CHECKIN',
                'PULL_REQUEST',
                'CODE_REVIEW',
                'BUG_FIX',
                'STORY_CLOSURE'
            );
        `);

        // Create activities table with comprehensive tracking fields
        await queryRunner.query(`
            CREATE TABLE ${this.schema}.${this.tablePrefix}activities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_member_id UUID NOT NULL,
                type ${this.schema}.activity_type NOT NULL,
                points DECIMAL(10,2) NOT NULL CHECK (points >= 0),
                is_ai_generated BOOLEAN NOT NULL DEFAULT false,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT fk_team_member 
                    FOREIGN KEY (team_member_id) 
                    REFERENCES ${this.schema}.${this.tablePrefix}team_members(id)
                    ON DELETE CASCADE
            ) PARTITION BY RANGE (created_at);
        `);

        // Create indexes for efficient querying
        await queryRunner.query(`
            CREATE INDEX idx_activities_team_member 
            ON ${this.schema}.${this.tablePrefix}activities(team_member_id);
            
            CREATE INDEX idx_activities_type 
            ON ${this.schema}.${this.tablePrefix}activities(type);
            
            CREATE INDEX idx_activities_created_at 
            ON ${this.schema}.${this.tablePrefix}activities(created_at);
            
            CREATE INDEX idx_activities_ai_generated 
            ON ${this.schema}.${this.tablePrefix}activities(is_ai_generated);
            
            CREATE INDEX idx_activities_points 
            ON ${this.schema}.${this.tablePrefix}activities(points DESC);
            
            CREATE INDEX idx_activities_metadata 
            ON ${this.schema}.${this.tablePrefix}activities USING gin (metadata);
        `);

        // Create monthly partitions for rolling 12-month window
        const months = 12;
        const today = new Date();
        
        for (let i = 0; i < months; i++) {
            const startDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const endDate = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
            const partitionName = `activities_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}`;
            
            await queryRunner.query(`
                CREATE TABLE ${this.schema}.${this.tablePrefix}${partitionName}
                PARTITION OF ${this.schema}.${this.tablePrefix}activities
                FOR VALUES FROM ('${startDate.toISOString()}') TO ('${endDate.toISOString()}');
                
                CREATE INDEX idx_${partitionName}_created_at 
                ON ${this.schema}.${this.tablePrefix}${partitionName}(created_at);
            `);
        }

        // Create statistics gathering policy
        await queryRunner.query(`
            CREATE STATISTICS activities_stats ON 
                type, is_ai_generated, created_at 
            FROM ${this.schema}.${this.tablePrefix}activities;
        `);

        // Add table comment with documentation
        await queryRunner.query(`
            COMMENT ON TABLE ${this.schema}.${this.tablePrefix}activities IS 
            'Stores Azure DevOps activities with point calculations and AI detection flags. 
            Partitioned monthly for efficient querying of recent data.';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop monthly partitions in reverse order
        const months = 12;
        const today = new Date();
        
        for (let i = months - 1; i >= 0; i--) {
            const startDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const partitionName = `activities_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}`;
            
            await queryRunner.query(`
                DROP TABLE IF EXISTS ${this.schema}.${this.tablePrefix}${partitionName};
            `);
        }

        // Drop indexes
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_activities_team_member;
            DROP INDEX IF EXISTS idx_activities_type;
            DROP INDEX IF EXISTS idx_activities_created_at;
            DROP INDEX IF EXISTS idx_activities_ai_generated;
            DROP INDEX IF EXISTS idx_activities_points;
            DROP INDEX IF EXISTS idx_activities_metadata;
        `);

        // Drop statistics
        await queryRunner.query(`
            DROP STATISTICS IF EXISTS activities_stats;
        `);

        // Drop main table
        await queryRunner.query(`
            DROP TABLE IF EXISTS ${this.schema}.${this.tablePrefix}activities;
        `);

        // Drop enum type
        await queryRunner.query(`
            DROP TYPE IF EXISTS ${this.schema}.activity_type;
        `);
    }
}