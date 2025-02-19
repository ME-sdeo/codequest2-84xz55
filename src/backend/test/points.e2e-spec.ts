import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { WebSocket } from 'ws';
import { PointsService } from '../src/modules/points/points.service';
import { ActivityType } from '../src/interfaces/activity.interface';
import { v4 as uuidv4 } from 'uuid';

describe('Points System (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;
  let wsClient: WebSocket;
  let testTeamMemberId: string;
  let testActivityId: string;
  let testTenantId: string;

  beforeAll(async () => {
    // Create test IDs
    testTeamMemberId = uuidv4();
    testActivityId = uuidv4();
    testTenantId = uuidv4();

    // Initialize test module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [], // Add required modules
      providers: [PointsService]
    }).compile();

    // Create test application
    app = moduleFixture.createNestApplication();
    await app.init();
    httpServer = app.getHttpServer();

    // Initialize WebSocket client
    wsClient = new WebSocket(`ws://localhost:${process.env.PORT}/points`);
    await new Promise(resolve => wsClient.on('open', resolve));

    // Subscribe to tenant-specific updates
    wsClient.send(JSON.stringify({ 
      action: 'subscribe', 
      tenantId: testTenantId 
    }));
  });

  afterAll(async () => {
    // Cleanup connections
    wsClient.close();
    await app.close();
  });

  describe('Points Calculation', () => {
    it('should calculate correct base points for each activity type', async () => {
      const activities = Object.values(ActivityType).map(type => ({
        id: uuidv4(),
        type,
        teamMemberId: testTeamMemberId,
        isAiGenerated: false,
        metadata: {
          adoId: 'test-ado-id',
          repository: 'test-repo',
          branch: 'main',
          url: 'http://test.com',
          title: 'Test Activity',
          description: 'Test Description',
          size: 100,
          complexity: 5,
          tags: ['test'],
          aiConfidence: 0
        }
      }));

      for (const activity of activities) {
        const response = await request(httpServer)
          .post('/api/v1/points/calculate')
          .send(activity)
          .set('X-Tenant-ID', testTenantId)
          .expect(201);

        expect(response.body.basePoints).toBeDefined();
        expect(response.body.finalPoints).toBeDefined();
        expect(response.body.aiModifier).toBe(1);
      }
    });

    it('should apply correct AI modifier for AI-generated code', async () => {
      const activity = {
        id: uuidv4(),
        type: ActivityType.CODE_CHECKIN,
        teamMemberId: testTeamMemberId,
        isAiGenerated: true,
        metadata: {
          adoId: 'test-ado-id',
          repository: 'test-repo',
          branch: 'main',
          url: 'http://test.com',
          title: 'AI Generated Code',
          description: 'Generated by AI',
          size: 100,
          complexity: 5,
          tags: ['ai-generated'],
          aiConfidence: 0.9
        }
      };

      const response = await request(httpServer)
        .post('/api/v1/points/calculate')
        .send(activity)
        .set('X-Tenant-ID', testTenantId)
        .expect(201);

      expect(response.body.aiModifier).toBe(0.75);
      expect(response.body.finalPoints).toBe(Math.round(response.body.basePoints * 0.75));
    });

    it('should validate point calculations against configuration limits', async () => {
      const invalidActivity = {
        id: uuidv4(),
        type: 'INVALID_TYPE',
        teamMemberId: testTeamMemberId
      };

      await request(httpServer)
        .post('/api/v1/points/calculate')
        .send(invalidActivity)
        .set('X-Tenant-ID', testTenantId)
        .expect(400);
    });
  });

  describe('Points Awarding', () => {
    it('should award points and send real-time updates', async () => {
      const activity = {
        id: uuidv4(),
        type: ActivityType.PULL_REQUEST,
        teamMemberId: testTeamMemberId,
        isAiGenerated: false,
        metadata: {
          adoId: 'test-ado-id',
          repository: 'test-repo',
          branch: 'main',
          url: 'http://test.com',
          title: 'Test PR',
          description: 'Test Description',
          size: 100,
          complexity: 5,
          tags: ['test'],
          aiConfidence: 0
        }
      };

      // Listen for WebSocket updates
      const wsPromise = new Promise(resolve => {
        wsClient.once('message', data => {
          const update = JSON.parse(data.toString());
          expect(update.teamMemberId).toBe(testTeamMemberId);
          expect(update.points).toBeDefined();
          resolve(true);
        });
      });

      // Award points
      const response = await request(httpServer)
        .post('/api/v1/points/award')
        .send(activity)
        .set('X-Tenant-ID', testTenantId)
        .expect(201);

      expect(response.body.points).toBeDefined();
      expect(response.body.activityId).toBe(activity.id);

      // Verify real-time update was received
      await wsPromise;
    });

    it('should maintain transaction integrity during concurrent awards', async () => {
      const activities = Array(5).fill(null).map(() => ({
        id: uuidv4(),
        type: ActivityType.CODE_REVIEW,
        teamMemberId: testTeamMemberId,
        isAiGenerated: false,
        metadata: {
          adoId: 'test-ado-id',
          repository: 'test-repo',
          branch: 'main',
          url: 'http://test.com',
          title: 'Concurrent Test',
          description: 'Test Description',
          size: 100,
          complexity: 5,
          tags: ['test'],
          aiConfidence: 0
        }
      }));

      const results = await Promise.all(
        activities.map(activity => 
          request(httpServer)
            .post('/api/v1/points/award')
            .send(activity)
            .set('X-Tenant-ID', testTenantId)
        )
      );

      results.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.points).toBeDefined();
      });
    });
  });

  describe('Level Progression', () => {
    it('should calculate correct level progress', async () => {
      const response = await request(httpServer)
        .get(`/api/v1/points/progress/${testTeamMemberId}`)
        .set('X-Tenant-ID', testTenantId)
        .expect(200);

      expect(response.body.currentLevel).toBeDefined();
      expect(response.body.totalPoints).toBeDefined();
      expect(response.body.nextLevelThreshold).toBeDefined();
      expect(response.body.progressPercentage).toBeGreaterThanOrEqual(0);
      expect(response.body.progressPercentage).toBeLessThanOrEqual(100);
    });

    it('should handle level up events correctly', async () => {
      // Add enough points to trigger level up
      const activity = {
        id: uuidv4(),
        type: ActivityType.STORY_CLOSURE,
        teamMemberId: testTeamMemberId,
        isAiGenerated: false,
        metadata: {
          adoId: 'test-ado-id',
          repository: 'test-repo',
          branch: 'main',
          url: 'http://test.com',
          title: 'Level Up Test',
          description: 'Test Description',
          size: 1000,
          complexity: 10,
          tags: ['test'],
          aiConfidence: 0
        }
      };

      const wsPromise = new Promise(resolve => {
        wsClient.once('message', data => {
          const update = JSON.parse(data.toString());
          expect(update.type).toBe('LEVEL_UP');
          expect(update.teamMemberId).toBe(testTeamMemberId);
          resolve(true);
        });
      });

      await request(httpServer)
        .post('/api/v1/points/award')
        .send(activity)
        .set('X-Tenant-ID', testTenantId)
        .expect(201);

      await wsPromise;
    });
  });

  describe('Leaderboard', () => {
    it('should generate accurate team leaderboard', async () => {
      const response = await request(httpServer)
        .get('/api/v1/points/leaderboard')
        .query({ teamId: 'test-team-id', page: 1, limit: 10 })
        .set('X-Tenant-ID', testTenantId)
        .expect(200);

      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.total).toBeDefined();
      response.body.items.forEach(item => {
        expect(item.teamMemberId).toBeDefined();
        expect(item.points).toBeDefined();
      });
    });

    it('should update leaderboard in real-time', async () => {
      const wsPromise = new Promise(resolve => {
        wsClient.once('message', data => {
          const update = JSON.parse(data.toString());
          expect(update.type).toBe('LEADERBOARD_UPDATE');
          resolve(true);
        });
      });

      const activity = {
        id: uuidv4(),
        type: ActivityType.BUG_FIX,
        teamMemberId: testTeamMemberId,
        isAiGenerated: false,
        metadata: {
          adoId: 'test-ado-id',
          repository: 'test-repo',
          branch: 'main',
          url: 'http://test.com',
          title: 'Leaderboard Test',
          description: 'Test Description',
          size: 100,
          complexity: 5,
          tags: ['test'],
          aiConfidence: 0
        }
      };

      await request(httpServer)
        .post('/api/v1/points/award')
        .send(activity)
        .set('X-Tenant-ID', testTenantId)
        .expect(201);

      await wsPromise;
    });
  });
});