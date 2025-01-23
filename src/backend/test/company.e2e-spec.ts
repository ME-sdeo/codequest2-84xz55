import { Test, TestingModule } from '@nestjs/testing'; // ^10.0.0
import { INestApplication, HttpStatus } from '@nestjs/common'; // ^10.0.0
import * as request from 'supertest'; // ^6.3.3
import { getConnection, Connection } from 'typeorm';
import { CompanyService } from '../src/modules/company/company.service';
import { CreateCompanyDto } from '../src/dto/company/create-company.dto';
import { SubscriptionTier, PointConfig } from '../src/interfaces/tenant.interface';
import { ROLES } from '../src/constants/roles.constants';

describe('Company E2E Tests', () => {
  let app: INestApplication;
  let companyService: CompanyService;
  let connection: Connection;
  const TEST_TIMEOUT = 30000;
  const PERFORMANCE_THRESHOLD = 500; // 500ms as per requirements

  // Test company data
  const testCompany: CreateCompanyDto = {
    name: 'TestCorp',
    subscriptionTier: SubscriptionTier.ENTERPRISE,
    pointConfig: {
      basePoints: {
        codeCheckIn: 10,
        pullRequest: 25,
        codeReview: 15,
        bugFix: 20,
        storyClosure: 30
      },
      aiModifier: 0.75,
      orgOverrides: {}
    }
  };

  beforeAll(async () => {
    // Create test module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Import required modules with test configuration
        TypeOrmModule.forRoot({
          type: 'postgres',
          database: 'codequest_test',
          synchronize: true,
          logging: false
        }),
        CompanyModule,
        CacheModule.register({
          ttl: 300 // 5 minutes cache for tests
        })
      ],
      providers: [CompanyService]
    }).compile();

    app = moduleFixture.createApplication();
    
    // Configure middleware and global pipes
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    }));

    await app.init();
    
    companyService = moduleFixture.get<CompanyService>(CompanyService);
    connection = getConnection();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await connection.dropDatabase(); // Clean up test database
    await app.close();
  });

  describe('Company Creation', () => {
    it('should create a company and validate performance', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .send(testCompany)
        .expect(HttpStatus.CREATED);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Verify performance requirement
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD);

      // Verify response structure
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(testCompany.name);
      expect(response.body.subscriptionTier).toBe(testCompany.subscriptionTier);
      
      // Verify point configuration
      expect(response.body.pointConfig).toEqual(testCompany.pointConfig);
      
      // Verify tenant isolation
      const companyId = response.body.id;
      const isolationTest = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/points`)
        .set('X-Tenant-Id', 'different-tenant')
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should enforce unique company names', async () => {
      // Attempt to create company with same name
      await request(app.getHttpServer())
        .post('/api/v1/companies')
        .send(testCompany)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('AI Point Modifiers', () => {
    let companyId: string;

    beforeEach(async () => {
      // Create test company for AI modifier tests
      const company = await companyService.createCompany(testCompany);
      companyId = company.id;
    });

    it('should update AI point modifiers', async () => {
      const newModifiers = {
        codeCheckIn: 0.8,
        pullRequest: 0.7,
        codeReview: 0.75,
        bugFix: 0.85,
        storyClosure: 0.9
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/companies/${companyId}/ai-point-modifiers`)
        .send(newModifiers)
        .expect(HttpStatus.OK);

      // Verify modifiers were updated
      expect(response.body.aiModifiers).toEqual(newModifiers);

      // Test point calculation with new modifiers
      const testActivity = {
        type: 'codeCheckIn',
        isAIGenerated: true
      };

      const pointsResponse = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/calculate-points`)
        .send(testActivity)
        .expect(HttpStatus.OK);

      // Verify AI modifier was applied correctly
      const expectedPoints = testCompany.pointConfig.basePoints.codeCheckIn * newModifiers.codeCheckIn;
      expect(pointsResponse.body.points).toBe(expectedPoints);
    });

    it('should validate AI modifier ranges', async () => {
      const invalidModifiers = {
        codeCheckIn: 1.5, // Invalid: > 1.0
        pullRequest: 0.7,
        codeReview: 0.75,
        bugFix: -0.1, // Invalid: < 0
        storyClosure: 0.9
      };

      await request(app.getHttpServer())
        .put(`/api/v1/companies/${companyId}/ai-point-modifiers`)
        .send(invalidModifiers)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Performance and Scaling', () => {
    it('should handle concurrent requests within performance threshold', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests).fill(null).map(() => {
        return request(app.getHttpServer())
          .get('/api/v1/companies')
          .set('X-Tenant-Id', 'test-tenant');
      });

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // Verify all requests completed successfully
      responses.forEach(response => {
        expect(response.status).toBe(HttpStatus.OK);
      });

      // Verify average response time meets requirement
      const averageTime = (endTime - startTime) / concurrentRequests;
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    it('should enforce rate limiting', async () => {
      const rateLimitRequests = 101; // Exceeds 100 requests per minute limit
      const requests = Array(rateLimitRequests).fill(null).map(() => {
        return request(app.getHttpServer())
          .get('/api/v1/companies')
          .set('X-Tenant-Id', 'test-tenant');
      });

      const responses = await Promise.all(requests);
      
      // Verify rate limit was enforced
      const rateLimitedResponses = responses.filter(
        response => response.status === HttpStatus.TOO_MANY_REQUESTS
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should maintain data isolation between tenants', async () => {
      // Create companies for different tenants
      const tenant1Company = await companyService.createCompany({
        ...testCompany,
        name: 'Tenant1Corp'
      });
      
      const tenant2Company = await companyService.createCompany({
        ...testCompany,
        name: 'Tenant2Corp'
      });

      // Attempt cross-tenant access
      await request(app.getHttpServer())
        .get(`/api/v1/companies/${tenant1Company.id}`)
        .set('X-Tenant-Id', tenant2Company.id)
        .expect(HttpStatus.FORBIDDEN);

      // Verify proper tenant access
      await request(app.getHttpServer())
        .get(`/api/v1/companies/${tenant1Company.id}`)
        .set('X-Tenant-Id', tenant1Company.id)
        .expect(HttpStatus.OK);
    });
  });
});