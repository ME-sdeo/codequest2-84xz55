// typeorm v0.3.0
import { MigrationInterface, QueryRunner } from 'typeorm';
import { databaseConfig } from '../../src/config/database.config';

export class AddTeamTables implements MigrationInterface {
    private readonly tablePrefix = 'codequest_';
    private readonly schema = databaseConfig.schema || 'public';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create teams table
        await queryRunner.query(`
            CREATE TABLE ${this.schema}.${this.tablePrefix}teams (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                total_points BIGINT NOT NULL DEFAULT 0,
                member_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_team_organization 
                    FOREIGN KEY (organization_id) 
                    REFERENCES ${this.schema}.${this.tablePrefix}organizations(id) 
                    ON DELETE CASCADE
            );
        `);

        // Create team_members table with partitioning support
        await queryRunner.query(`
            CREATE TABLE ${this.schema}.${this.tablePrefix}team_members (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID NOT NULL,
                user_id UUID NOT NULL,
                company_id UUID NOT NULL,
                total_points BIGINT NOT NULL DEFAULT 0,
                current_level INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_team_member_team 
                    FOREIGN KEY (team_id) 
                    REFERENCES ${this.schema}.${this.tablePrefix}teams(id) 
                    ON DELETE CASCADE,
                CONSTRAINT fk_team_member_user 
                    FOREIGN KEY (user_id) 
                    REFERENCES ${this.schema}.${this.tablePrefix}users(id) 
                    ON DELETE CASCADE
            ) PARTITION BY LIST (company_id);
        `);

        // Create default partition for team_members
        await queryRunner.query(`
            CREATE TABLE ${this.schema}.${this.tablePrefix}team_members_default 
            PARTITION OF ${this.schema}.${this.tablePrefix}team_members 
            DEFAULT;
        `);

        // Create indexes for performance optimization
        await queryRunner.query(`
            CREATE INDEX idx_teams_org_name 
            ON ${this.schema}.${this.tablePrefix}teams(organization_id, name);
            
            CREATE INDEX idx_teams_points 
            ON ${this.schema}.${this.tablePrefix}teams(total_points DESC);
            
            CREATE INDEX idx_team_members_team_user 
            ON ${this.schema}.${this.tablePrefix}team_members(team_id, user_id);
            
            CREATE INDEX idx_team_members_points 
            ON ${this.schema}.${this.tablePrefix}team_members(total_points DESC);
            
            CREATE INDEX idx_team_members_company 
            ON ${this.schema}.${this.tablePrefix}team_members(company_id);
        `);

        // Create trigger for updating member count
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION ${this.schema}.update_team_member_count()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    UPDATE ${this.schema}.${this.tablePrefix}teams 
                    SET member_count = member_count + 1 
                    WHERE id = NEW.team_id;
                ELSIF TG_OP = 'DELETE' THEN
                    UPDATE ${this.schema}.${this.tablePrefix}teams 
                    SET member_count = member_count - 1 
                    WHERE id = OLD.team_id;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER trg_team_member_count
            AFTER INSERT OR DELETE ON ${this.schema}.${this.tablePrefix}team_members
            FOR EACH ROW
            EXECUTE FUNCTION ${this.schema}.update_team_member_count();
        `);

        // Create trigger for updating updated_at timestamp
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION ${this.schema}.update_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER trg_teams_timestamp
            BEFORE UPDATE ON ${this.schema}.${this.tablePrefix}teams
            FOR EACH ROW
            EXECUTE FUNCTION ${this.schema}.update_timestamp();

            CREATE TRIGGER trg_team_members_timestamp
            BEFORE UPDATE ON ${this.schema}.${this.tablePrefix}team_members
            FOR EACH ROW
            EXECUTE FUNCTION ${this.schema}.update_timestamp();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop triggers first
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS trg_team_members_timestamp 
            ON ${this.schema}.${this.tablePrefix}team_members;
            
            DROP TRIGGER IF EXISTS trg_teams_timestamp 
            ON ${this.schema}.${this.tablePrefix}teams;
            
            DROP TRIGGER IF EXISTS trg_team_member_count 
            ON ${this.schema}.${this.tablePrefix}team_members;
            
            DROP FUNCTION IF EXISTS ${this.schema}.update_timestamp();
            DROP FUNCTION IF EXISTS ${this.schema}.update_team_member_count();
        `);

        // Drop indexes
        await queryRunner.query(`
            DROP INDEX IF EXISTS ${this.schema}.idx_team_members_company;
            DROP INDEX IF EXISTS ${this.schema}.idx_team_members_points;
            DROP INDEX IF EXISTS ${this.schema}.idx_team_members_team_user;
            DROP INDEX IF EXISTS ${this.schema}.idx_teams_points;
            DROP INDEX IF EXISTS ${this.schema}.idx_teams_org_name;
        `);

        // Drop team_members partitions and table
        await queryRunner.query(`
            DROP TABLE IF EXISTS ${this.schema}.${this.tablePrefix}team_members_default;
            DROP TABLE IF EXISTS ${this.schema}.${this.tablePrefix}team_members;
        `);

        // Drop teams table
        await queryRunner.query(`
            DROP TABLE IF EXISTS ${this.schema}.${this.tablePrefix}teams;
        `);
    }
}