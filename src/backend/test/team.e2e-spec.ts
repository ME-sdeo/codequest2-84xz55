import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Redis } from 'ioredis';
import { AppModule } from '../src/app.module';
import { TeamService } from '../src/modules/team/team.service';

describe('Team Management E2E Tests', () => {
  let app: INestApplication;
  let teamService: TeamService;
  let redisClient: Redis;

  // Test data constants
  const TEST_COMPANY_ID = '550e8400-e29b-41d4-a716-446655440000';
  const TEST_ORG_ID = '7c4d4d4d-4d4d-4d4d-4d4d-4d4d4d4d4d4d';
  const TEST_TEAM_NAME = 'Frontend Team';
  const TEST_USER_ID = 'a1b2c3d4-e5f6-4a5b-8c7d-9e8f7a6b5c4d';

  beforeAll(async () => {
    // Create test module with full application context
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    teamService = moduleFixture.get<TeamService>(TeamService);
    redisClient = new Redis(process.env.REDIS_URL);

    // Initialize application with middleware and guards
    await app.init();
    await setupTestDatabase();
    await setupTestCache();
  });

  afterAll(async () => {
    await cleanupTestData();
    await redisClient.quit();
    await app.close();
  });

  beforeEach(async () => {
    // Clear cache and reset test data before each test
    await redisClient.flushall();
  });

  describe('Team Creation and Management', () => {
    it('should create a new team with proper tenant isolation', async () => {
      const response = await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', 'Bearer test-token')
        .set('x-tenant-id', TEST_COMPANY_ID)
        .send({
          name: TEST_TEAM_NAME,
          organizationId: TEST_ORG_ID,
          maxMembers: 10
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: TEST_TEAM_NAME,
        organizationId: TEST_ORG_ID,
        totalPoints: 0,
        memberCount: 0,
        maxMembers: 10
      });

      // Verify tenant isolation
      const wrongTenantResponse = await request(app.getHttpServer())
        .get(`/teams/${response.body.id}`)
        .set('Authorization', 'Bearer test-token')
        .set('x-tenant-id', 'wrong-tenant-id');

      expect(wrongTenantResponse.status).toBe(403);
    });

    it('should prevent duplicate team names within same organization', async () => {
      // Create first team
      await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', 'Bearer test-token')
        .set('x-tenant-id', TEST_COMPANY_ID)
        .send({
          name: TEST_TEAM_NAME,
          organizationId: TEST_ORG_ID,
          maxMembers: 10
        });

      // Attempt to create duplicate
      const duplicateResponse = await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', 'Bearer test-token')
        .set('x-tenant-id', TEST_COMPANY_ID)
        .send({
          name: TEST_TEAM_NAME,
          organizationId: TEST_ORG_ID,
          maxMembers: 10
        });

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.message).toContain('Team name already exists');
    });

    it('should enforce team member limits based on subscription tier', async () => {
      const response = await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', 'Bearer test-token')
        .set('x-tenant-id', TEST_COMPANY_ID)
        .send({
          name: 'Large Team',
          organizationId: TEST_ORG_ID,
          maxMembers: 1000 // Exceeds SMALL tier limit
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('exceeds subscription tier limit');
    });
  });

  describe('Team Points and Activities', () => {
    let testTeamId: string;

    beforeEach(async () => {
      // Create test team for points testing
      const team = await teamService.createTeam({
        name: 'Test Points Team',
        organizationId: TEST_ORG_ID,
        maxMembers: 10,
        createdBy: TEST_USER_ID
      });
      testTeamId = team.id;
    });

    it('should calculate points correctly with AI detection', async () => {
      const activity = {
        teamMemberId: TEST_USER_ID,
        activityType: 'CODE_REVIEW',
        isAiGenerated: true,
        basePoints: 15
      };

      const response = await request(app.getHttpServer())
        .post(`/teams/${testTeamId}/points`)
        .set('Authorization', 'Bearer test-token')
        .set('x-tenant-id', TEST_COMPANY_ID)
        .send(activity);

      expect(response.status).toBe(200);
      expect(response.body.points).toBe(11); // 15 * 0.75 for AI-generated
      
      // Verify cache update
      const cachedPoints = await redisClient.get(`team:${testTeamId}:points`);
      expect(parseInt(cachedPoints)).toBe(11);
    });

    it('should update team leaderboard in real-time', async () => {
      // Add points to team
      await teamService.updateTeamPoints(testTeamId, 100, false);

      // Verify leaderboard update
      const response = await request(app.getHttpServer())
        .get(`/organizations/${TEST_ORG_ID}/leaderboard`)
        .set('Authorization', 'Bearer test-token')
        .set('x-tenant-id', TEST_COMPANY_ID);

      expect(response.status).toBe(200);
      expect(response.body.teams[0].id).toBe(testTeamId);
      expect(response.body.teams[0].totalPoints).toBe(100);

      // Verify leaderboard cache
      const cachedLeaderboard = await redisClient.get(
        `leaderboard:${TEST_ORG_ID}`
      );
      expect(JSON.parse(cachedLeaderboard)).toMatchObject(response.body);
    });

    it('should track AI vs non-AI points separately', async () => {
      // Add AI-generated points
      await teamService.updateTeamPoints(testTeamId, 100, true);
      
      // Add standard points
      await teamService.updateTeamPoints(testTeamId, 100, false);

      const response = await request(app.getHttpServer())
        .get(`/teams/${testTeamId}/points-breakdown`)
        .set('Authorization', 'Bearer test-token')
        .set('x-tenant-id', TEST_COMPANY_ID);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalPoints: 175, // 75 (AI) + 100 (standard)
        aiGeneratedPoints: 75, // 100 * 0.75
        standardPoints: 100
      });
    });
  });

  async function setupTestDatabase() {
    // Initialize test database with required schemas and test data
    // Implementation would create test company, organization, and user records
  }

  async function setupTestCache() {
    // Initialize Redis test instance with required test data
    await redisClient.flushall();
  }

  async function cleanupTestData() {
    // Cleanup test data from database and cache
    await redisClient.flushall();
  }
});