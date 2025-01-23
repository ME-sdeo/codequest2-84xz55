// typeorm v0.3.0
import { MigrationInterface, QueryRunner } from 'typeorm';
import { databaseConfig } from '../../src/config/database.config';

const TABLE_PREFIX = 'codequest_';
const POINTS_RETENTION_PERIOD = '12 months';

export class AddPointsTables implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create points_history table with time-series partitioning
        await queryRunner.query(`
            CREATE TABLE ${TABLE_PREFIX}points_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_member_id UUID NOT NULL,
                activity_id UUID NOT NULL,
                base_points INTEGER NOT NULL CHECK (base_points >= 0),
                ai_modifier DECIMAL(3,2) CHECK (ai_modifier BETWEEN 0 AND 1.0),
                final_points INTEGER NOT NULL CHECK (final_points >= 0),
                is_ai_generated BOOLEAN NOT NULL DEFAULT false,
                activity_context JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_team_member 
                    FOREIGN KEY (team_member_id) 
                    REFERENCES ${TABLE_PREFIX}team_members(id) 
                    ON DELETE CASCADE,
                CONSTRAINT fk_activity 
                    FOREIGN KEY (activity_id) 
                    REFERENCES ${TABLE_PREFIX}activities(id) 
                    ON DELETE CASCADE,
                CONSTRAINT chk_points_calculation 
                    CHECK (final_points = ROUND(base_points * COALESCE(ai_modifier, 1.0)))
            ) PARTITION BY RANGE (created_at);
        `);

        // Create monthly partitions for points_history
        await queryRunner.query(`
            SELECT create_time_bucket_partitions(
                '${TABLE_PREFIX}points_history',
                'created_at',
                INTERVAL '1 month',
                ${POINTS_RETENTION_PERIOD}
            );
        `);

        // Create achievements table
        await queryRunner.query(`
            CREATE TABLE ${TABLE_PREFIX}achievements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_member_id UUID NOT NULL,
                badge_type VARCHAR(50) NOT NULL,
                earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                points_at_earning INTEGER NOT NULL CHECK (points_at_earning >= 0),
                CONSTRAINT fk_team_member_achievement
                    FOREIGN KEY (team_member_id)
                    REFERENCES ${TABLE_PREFIX}team_members(id)
                    ON DELETE CASCADE
            );
        `);

        // Create level_history table
        await queryRunner.query(`
            CREATE TABLE ${TABLE_PREFIX}level_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_member_id UUID NOT NULL,
                old_level INTEGER NOT NULL CHECK (old_level >= 0),
                new_level INTEGER NOT NULL CHECK (new_level > old_level),
                points_at_change INTEGER NOT NULL CHECK (points_at_change >= 0),
                changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_team_member_level
                    FOREIGN KEY (team_member_id)
                    REFERENCES ${TABLE_PREFIX}team_members(id)
                    ON DELETE CASCADE
            );
        `);

        // Create indexes for performance optimization
        await queryRunner.query(`
            -- Points history indexes
            CREATE INDEX idx_points_history_team_member_date 
                ON ${TABLE_PREFIX}points_history(team_member_id, created_at DESC);
            
            CREATE INDEX idx_points_history_ai_generated 
                ON ${TABLE_PREFIX}points_history(is_ai_generated) 
                WHERE is_ai_generated = true;
            
            CREATE INDEX idx_points_history_activity_type 
                ON ${TABLE_PREFIX}points_history((activity_context->>'type'));

            -- Achievements indexes
            CREATE INDEX idx_achievements_team_member_date
                ON ${TABLE_PREFIX}achievements(team_member_id, earned_at DESC);
            
            CREATE INDEX idx_achievements_badge_type
                ON ${TABLE_PREFIX}achievements(badge_type);

            -- Level history indexes
            CREATE INDEX idx_level_history_team_member_date
                ON ${TABLE_PREFIX}level_history(team_member_id, changed_at DESC);
        `);

        // Set up continuous aggregates for historical analysis
        await queryRunner.query(`
            CREATE MATERIALIZED VIEW ${TABLE_PREFIX}points_daily_summary
            WITH (timescaledb.continuous) AS
            SELECT 
                time_bucket('1 day', created_at) AS day,
                team_member_id,
                COUNT(*) as total_activities,
                SUM(final_points) as points_earned,
                COUNT(*) FILTER (WHERE is_ai_generated) as ai_activities
            FROM ${TABLE_PREFIX}points_history
            GROUP BY 1, 2;

            SELECT add_continuous_aggregate_policy('${TABLE_PREFIX}points_daily_summary',
                start_offset => INTERVAL '${POINTS_RETENTION_PERIOD}',
                end_offset => INTERVAL '1 hour',
                schedule_interval => INTERVAL '1 hour');
        `);

        // Add table comments for documentation
        await queryRunner.query(`
            COMMENT ON TABLE ${TABLE_PREFIX}points_history IS 'Tracks all point awards with AI detection and context';
            COMMENT ON TABLE ${TABLE_PREFIX}achievements IS 'Records earned achievements and badges';
            COMMENT ON TABLE ${TABLE_PREFIX}level_history IS 'Tracks developer level progression';
            COMMENT ON MATERIALIZED VIEW ${TABLE_PREFIX}points_daily_summary IS 'Daily aggregated points statistics';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop continuous aggregates and policies
        await queryRunner.query(`
            DROP MATERIALIZED VIEW IF EXISTS ${TABLE_PREFIX}points_daily_summary CASCADE;
        `);

        // Drop indexes
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_points_history_team_member_date;
            DROP INDEX IF EXISTS idx_points_history_ai_generated;
            DROP INDEX IF EXISTS idx_points_history_activity_type;
            DROP INDEX IF EXISTS idx_achievements_team_member_date;
            DROP INDEX IF EXISTS idx_achievements_badge_type;
            DROP INDEX IF EXISTS idx_level_history_team_member_date;
        `);

        // Drop tables in correct order
        await queryRunner.query(`
            DROP TABLE IF EXISTS ${TABLE_PREFIX}level_history CASCADE;
            DROP TABLE IF EXISTS ${TABLE_PREFIX}achievements CASCADE;
            DROP TABLE IF EXISTS ${TABLE_PREFIX}points_history CASCADE;
        `);

        // Clean up any remaining partitions
        await queryRunner.query(`
            SELECT drop_time_bucket_partitions('${TABLE_PREFIX}points_history');
        `);
    }
}