/**
 * @fileoverview End-to-end tests for authentication endpoints and flows in the CodeQuest platform
 * Implements comprehensive testing of authentication, SSO integration, and security controls
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing'; // ^10.0.0
import { INestApplication } from '@nestjs/common'; // ^10.0.0
import * as request from 'supertest'; // ^6.3.0
import * as pactum from 'pactum'; // ^3.5.0
import { AuthModule } from '../src/modules/auth/auth.module';
import { ROLES } from '../src/constants/roles.constants';

// Test constants
const TEST_TIMEOUT = 30000;
const RATE_LIMIT_WINDOW = 60000;
const MAX_LOGIN_ATTEMPTS = 5;

// Test data constants
const TEST_TENANTS = {
  tenant1: { id: 'test-tenant-1', name: 'Test Org 1' },
  tenant2: { id: 'test-tenant-2', name: 'Test Org 2' }
};

const MOCK_SSO_PROVIDERS = {
  azure: { clientId: 'test-azure', tenant: 'common' },
  okta: { clientId: 'test-okta', domain: 'test.okta.com' }
};

const SECURITY_SETTINGS = {
  rateLimit: { points: 5, duration: 60 },
  jwt: { expiresIn: '1h', refreshIn: '7d' }
};

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Create test module with security configurations
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configure security middleware
    app.enableCors({
      origin: ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Initialize test HTTP client
    pactum.request.setBaseUrl('http://localhost:3000');
    pactum.request.setDefaultTimeout(TEST_TIMEOUT);

    await app.init();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await app.close();
  });

  describe('Standard Authentication', () => {
    describe('POST /auth/login', () => {
      it('should successfully authenticate valid credentials', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'ValidP@ssw0rd'
          })
          .expect(200);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body).toHaveProperty('refresh_token');

        // Validate JWT structure
        const token = response.body.access_token;
        expect(token.split('.')).toHaveLength(3);
        authToken = token;
      });

      it('should enforce rate limiting after multiple failed attempts', async () => {
        const attempts = Array(MAX_LOGIN_ATTEMPTS + 1).fill({
          email: 'test@example.com',
          password: 'WrongPassword'
        });

        for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
          await request(app.getHttpServer())
            .post('/auth/login')
            .send(attempts[i])
            .expect(401);
        }

        // Next attempt should be rate limited
        await request(app.getHttpServer())
          .post('/auth/login')
          .send(attempts[MAX_LOGIN_ATTEMPTS])
          .expect(429);
      });

      it('should validate input against SQL injection', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: "' OR '1'='1",
            password: "' OR '1'='1"
          })
          .expect(400);
      });

      it('should include required security headers', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'ValidP@ssw0rd'
          });

        expect(response.headers).toMatchObject({
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'x-xss-protection': '1; mode=block',
          'strict-transport-security': 'max-age=31536000; includeSubDomains'
        });
      });
    });

    describe('POST /auth/refresh', () => {
      it('should issue new access token with valid refresh token', async () => {
        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'ValidP@ssw0rd'
          });

        await request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refresh_token: loginResponse.body.refresh_token })
          .expect(200)
          .expect(res => {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body.access_token).not.toBe(loginResponse.body.access_token);
          });
      });

      it('should reject expired refresh tokens', async () => {
        await request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refresh_token: 'expired.refresh.token' })
          .expect(401);
      });
    });
  });

  describe('SSO Authentication', () => {
    describe('POST /auth/sso/callback', () => {
      it('should handle Azure AD SSO callback', async () => {
        const mockAzureProfile = {
          provider: 'azure',
          email: 'azure@example.com',
          sub: 'azure-user-id',
          name: 'Azure User',
          tenant_id: TEST_TENANTS.tenant1.id
        };

        await request(app.getHttpServer())
          .post('/auth/sso/callback')
          .send(mockAzureProfile)
          .expect(200)
          .expect(res => {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('refresh_token');
          });
      });

      it('should handle Okta SSO callback', async () => {
        const mockOktaProfile = {
          provider: 'okta',
          email: 'okta@example.com',
          sub: 'okta-user-id',
          name: 'Okta User',
          tenant_id: TEST_TENANTS.tenant1.id
        };

        await request(app.getHttpServer())
          .post('/auth/sso/callback')
          .send(mockOktaProfile)
          .expect(200)
          .expect(res => {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('refresh_token');
          });
      });

      it('should enforce tenant isolation in SSO flow', async () => {
        const mockProfile = {
          provider: 'azure',
          email: 'test@example.com',
          sub: 'user-id',
          tenant_id: TEST_TENANTS.tenant2.id
        };

        // First authenticate with tenant1
        await request(app.getHttpServer())
          .post('/auth/sso/callback')
          .send({ ...mockProfile, tenant_id: TEST_TENANTS.tenant1.id })
          .expect(200);

        // Attempt to access tenant2 resources
        await request(app.getHttpServer())
          .get('/api/resources')
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-Tenant-ID', TEST_TENANTS.tenant2.id)
          .expect(403);
      });

      it('should validate SSO token signatures', async () => {
        const invalidToken = 'invalid.sso.token';
        
        await request(app.getHttpServer())
          .post('/auth/sso/validate')
          .send({ token: invalidToken })
          .expect(401);
      });
    });
  });

  describe('Security Controls', () => {
    it('should prevent CSRF attacks', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', 'http://malicious-site.com')
        .send({
          email: 'test@example.com',
          password: 'ValidP@ssw0rd'
        })
        .expect(403);
    });

    it('should detect and block suspicious login patterns', async () => {
      const suspiciousIPs = ['1.1.1.1', '2.2.2.2', '3.3.3.3'];
      
      for (const ip of suspiciousIPs) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('X-Forwarded-For', ip)
          .send({
            email: 'test@example.com',
            password: 'WrongPassword'
          })
          .expect(401);
      }

      // Next attempt should trigger security alert
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', suspiciousIPs[0])
        .send({
          email: 'test@example.com',
          password: 'ValidP@ssw0rd'
        })
        .expect(429);
    });

    it('should enforce password complexity requirements', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          role: ROLES.DEVELOPER
        })
        .expect(400);
    });

    it('should validate tenant context in all requests', async () => {
      await request(app.getHttpServer())
        .get('/api/protected-resource')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400); // Missing tenant context
    });
  });
});