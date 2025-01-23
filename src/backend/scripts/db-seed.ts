/**
 * @fileoverview Database seeding script for CodeQuest
 * Populates database with initial test data including companies, organizations,
 * teams and point configurations with AI detection support
 * @version 1.0.0
 */

import { DataSource } from 'typeorm'; // v0.3.0
import { faker } from '@faker-js/faker'; // v8.0.0
import * as dotenv from 'dotenv'; // v16.0.0
import { CompanyEntity } from '../src/entities/company.entity';
import { OrganizationEntity } from '../src/entities/organization.entity';
import { TeamEntity } from '../src/entities/team.entity';
import { databaseConfig } from '../src/config/database.config';
import { SubscriptionTier } from '../src/interfaces/tenant.interface';

// Load environment variables
dotenv.config();

// Seeding constants
const DEFAULT_COMPANIES_COUNT = 5;
const DEFAULT_ORGS_PER_COMPANY = 3;
const DEFAULT_TEAMS_PER_ORG = 4;

// Default point configuration based on technical specification A.1.1
const DEFAULT_POINT_CONFIG = {
  basePoints: {
    codeCheckIn: 10,
    pullRequest: 25,
    codeReview: 15,
    bugFix: 20,
    storyClosure: 30
  },
  aiModifier: 0.75,
  orgOverrides: {}
};

/**
 * Seeds companies with different subscription tiers and point configurations
 * @param dataSource - TypeORM data source
 * @returns Array of created company entities
 */
async function seedCompanies(dataSource: DataSource): Promise<CompanyEntity[]> {
  const companyRepository = dataSource.getRepository(CompanyEntity);
  const companies: CompanyEntity[] = [];

  // Create companies with different subscription tiers
  const tiers = [SubscriptionTier.SMALL, SubscriptionTier.MEDIUM, SubscriptionTier.ENTERPRISE];
  
  for (let i = 0; i < DEFAULT_COMPANIES_COUNT; i++) {
    const tier = tiers[i % tiers.length];
    const company = new CompanyEntity(
      faker.company.name(),
      tier,
      DEFAULT_POINT_CONFIG,
      {
        codeCheckIn: 0.75,
        pullRequest: 0.75,
        codeReview: 0.75,
        bugFix: 0.75,
        storyClosure: 0.75
      }
    );
    companies.push(company);
  }

  return await companyRepository.save(companies);
}

/**
 * Seeds organizations for each company with point overrides
 * @param dataSource - TypeORM data source
 * @param companies - Array of created companies
 * @returns Array of created organization entities
 */
async function seedOrganizations(
  dataSource: DataSource,
  companies: CompanyEntity[]
): Promise<OrganizationEntity[]> {
  const orgRepository = dataSource.getRepository(OrganizationEntity);
  const organizations: OrganizationEntity[] = [];

  for (const company of companies) {
    const orgCount = company.subscriptionTier === SubscriptionTier.SMALL ? 1 :
      company.subscriptionTier === SubscriptionTier.MEDIUM ? 5 : DEFAULT_ORGS_PER_COMPANY;

    for (let i = 0; i < orgCount; i++) {
      const organization = new OrganizationEntity(
        faker.company.catchPhrase(),
        company.id,
        {
          basePoints: {
            codeCheckIn: faker.number.int({ min: 8, max: 12 }),
            pullRequest: faker.number.int({ min: 20, max: 30 }),
            codeReview: faker.number.int({ min: 12, max: 18 }),
            bugFix: faker.number.int({ min: 15, max: 25 }),
            storyClosure: faker.number.int({ min: 25, max: 35 })
          },
          aiModifier: 0.75
        },
        'system'
      );
      organizations.push(organization);
    }
  }

  return await orgRepository.save(organizations);
}

/**
 * Seeds teams for each organization with AI point tracking
 * @param dataSource - TypeORM data source
 * @param organizations - Array of created organizations
 * @returns Array of created team entities
 */
async function seedTeams(
  dataSource: DataSource,
  organizations: OrganizationEntity[]
): Promise<TeamEntity[]> {
  const teamRepository = dataSource.getRepository(TeamEntity);
  const teams: TeamEntity[] = [];

  for (const org of organizations) {
    const company = await org.company;
    const teamCount = company.subscriptionTier === SubscriptionTier.SMALL ? 2 :
      company.subscriptionTier === SubscriptionTier.MEDIUM ? 4 : DEFAULT_TEAMS_PER_ORG;

    for (let i = 0; i < teamCount; i++) {
      const maxMembers = company.subscriptionTier === SubscriptionTier.SMALL ? 10 :
        company.subscriptionTier === SubscriptionTier.MEDIUM ? 20 : 50;

      const team = new TeamEntity(
        faker.company.buzzPhrase(),
        org.id,
        maxMembers
      );
      teams.push(team);
    }
  }

  return await teamRepository.save(teams);
}

/**
 * Main seeding function that orchestrates the entire process
 */
async function main() {
  console.log('Starting database seeding...');
  
  const dataSource = new DataSource({
    ...databaseConfig,
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: true
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    await dataSource.transaction(async (transactionalEntityManager) => {
      const companies = await seedCompanies(dataSource);
      console.log(`Created ${companies.length} companies`);

      const organizations = await seedOrganizations(dataSource, companies);
      console.log(`Created ${organizations.length} organizations`);

      const teams = await seedTeams(dataSource, organizations);
      console.log(`Created ${teams.length} teams`);

      console.log('Seeding completed successfully');
    });

  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Execute seeding
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error during seeding:', error);
      process.exit(1);
    });
}

export { seedCompanies, seedOrganizations, seedTeams };