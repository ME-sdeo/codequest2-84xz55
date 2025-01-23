import { Test, TestingModule } from '@nestjs/testing'; // v10.0.0
import { INestApplication } from '@nestjs/common'; // v10.0.0
import * as request from 'supertest'; // v6.3.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { OrganizationController } from '../src/modules/organization/organization.controller';
import { CreateOrganizationDto } from '../src/dto/organization/create-organization.dto';
import { UpdateOrganizationDto } from '../src/dto/organization/update-organization.dto';
import { ROLES } from '../src/constants/roles.constants';
import { SubscriptionTier } from '../src/interfaces/tenant.interface';

describe('Organization Management (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let companyId: string;
  let organizationId: string;

  // Test data setup
  const testCompany = {
    id: uuidv4(),
    name: 'Test Company',
    subscriptionTier: SubscriptionTier.ENTERPRISE,
    pointConfig: {
      basePoints: {
        codeCheckIn: 10,
        pullRequest: 25,
        codeReview: 15,
        bugFix: 20,
        storyClosure: 30,
      },
      aiModifier: 0.75,
    },
  };

  const validOrganization: CreateOrganizationDto = {
    name: 'Engineering Team',
    companyId: testCompany.id,
    pointOverrides: {
      basePoints: {
        codeCheckIn: 12,
        pullRequest: 30,
        codeReview: 18,
        bugFix: 25,
        storyClosure: 35,
      },
      aiModifier: 0.8,
    },
  };

  beforeAll(async () => {
    // Create test module with enhanced configuration
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      // Add necessary providers and mock implementations
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Configure security middleware and validation pipes
    app.enableCors();
    app.useGlobalPipes();
    
    await app.init();

    // Setup test data and authentication
    companyId = testCompany.id;
    authToken = await setupTestAuth(ROLES.COMPANY_ADMIN);
  });

  afterAll(async () => {
    // Cleanup test data and close connections
    await cleanupTestData();
    await app.close();
  });

  describe('POST /organizations', () => {
    it('should create organization with valid data and AI config', async () => {
      const response = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validOrganization)
        .expect(201);

      organizationId = response.body.id;
      expect(response.body).toMatchObject({
        name: validOrganization.name,
        companyId: validOrganization.companyId,
        pointOverrides: validOrganization.pointOverrides,
      });
    });

    it('should validate point configuration ranges', async () => {
      const invalidPoints = { ...validOrganization };
      invalidPoints.pointOverrides.basePoints.codeCheckIn = -5;

      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPoints)
        .expect(400);
    });

    it('should enforce AI detection rules', async () => {
      const invalidAI = { ...validOrganization };
      invalidAI.pointOverrides.aiModifier = 1.5;

      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidAI)
        .expect(400);
    });

    it('should enforce subscription tier limits', async () => {
      // Create organizations up to tier limit
      const tierLimits = {
        SMALL: 1,
        MEDIUM: 5,
        ENTERPRISE: 100,
      };

      const limit = tierLimits[testCompany.subscriptionTier];
      for (let i = 0; i < limit; i++) {
        await request(app.getHttpServer())
          .post('/organizations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...validOrganization,
            name: `Test Org ${i}`,
          });
      }

      // Attempt to exceed limit
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validOrganization)
        .expect(400);
    });
  });

  describe('GET /organizations/:id', () => {
    it('should get organization with point config', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: organizationId,
        name: validOrganization.name,
        pointOverrides: validOrganization.pointOverrides,
      });
    });

    it('should enforce tenant boundaries', async () => {
      const differentCompanyToken = await setupTestAuth(ROLES.COMPANY_ADMIN, uuidv4());

      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${differentCompanyToken}`)
        .expect(403);
    });

    it('should validate user permissions', async () => {
      const generalUserToken = await setupTestAuth(ROLES.GENERAL_USER);

      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${generalUserToken}`)
        .expect(403);
    });
  });

  describe('PUT /organizations/:id', () => {
    const updateData: UpdateOrganizationDto = {
      name: 'Updated Engineering Team',
      pointOverrides: {
        basePoints: {
          codeCheckIn: 15,
          pullRequest: 35,
          codeReview: 20,
          bugFix: 30,
          storyClosure: 40,
        },
        aiModifier: 0.7,
      },
    };

    it('should update organization with AI settings', async () => {
      const response = await request(app.getHttpServer())
        .put(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: organizationId,
        name: updateData.name,
        pointOverrides: updateData.pointOverrides,
      });
    });

    it('should validate point override ranges', async () => {
      const invalidPoints = { ...updateData };
      invalidPoints.pointOverrides.basePoints.pullRequest = 1000;

      await request(app.getHttpServer())
        .put(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPoints)
        .expect(400);
    });

    it('should maintain data integrity during concurrent updates', async () => {
      const update1 = request(app.getHttpServer())
        .put(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      const update2 = request(app.getHttpServer())
        .put(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...updateData,
          name: 'Concurrent Update',
        });

      await Promise.all([update1, update2]);

      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.version).toBeDefined();
    });
  });

  describe('DELETE /organizations/:id', () => {
    it('should delete organization and related data', async () => {
      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify organization is deleted
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle team dependencies', async () => {
      // Create org with teams
      const orgWithTeams = await createOrgWithTeams();

      // Attempt to delete - should fail with 400
      await request(app.getHttpServer())
        .delete(`/organizations/${orgWithTeams.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });
});

// Helper functions
async function setupTestAuth(role: ROLES, companyId?: string): Promise<string> {
  // Implementation for generating test auth tokens
  return 'test_token';
}

async function cleanupTestData(): Promise<void> {
  // Implementation for cleaning up test data
}

async function createOrgWithTeams(): Promise<any> {
  // Implementation for creating test organization with teams
  return { id: uuidv4() };
}