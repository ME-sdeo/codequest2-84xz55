import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { AppConfig } from '../interfaces/config.interface';

// API Documentation Constants
const API_TITLE = 'CodeQuest API';
const API_DESCRIPTION = 'API documentation for CodeQuest gamification platform';
const API_VERSION = '1.0';
const SWAGGER_PATH = '/api-docs';

/**
 * Generates comprehensive OpenAPI documentation configuration for the CodeQuest API
 * @returns {OpenAPIObject} Complete Swagger/OpenAPI configuration object
 */
export const getSwaggerConfig = (): OpenAPIObject => {
  const builder = new DocumentBuilder()
    .setTitle(API_TITLE)
    .setDescription(API_DESCRIPTION)
    .setVersion(API_VERSION)
    // Configure security schemes
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'JWT-auth'
    )
    // API Tags for logical grouping
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Activities', 'Azure DevOps activity tracking endpoints')
    .addTag('Points', 'Point calculation and management endpoints')
    .addTag('Teams', 'Team management and leaderboard endpoints')
    .addTag('Organizations', 'Organization management endpoints')
    .addTag('Companies', 'Company-level configuration endpoints')
    .addTag('Analytics', 'Performance and metrics endpoints')
    // Server configurations for different environments
    .addServer({
      url: 'https://api.codequest.com',
      description: 'Production server',
    })
    .addServer({
      url: 'https://staging-api.codequest.com',
      description: 'Staging server',
    })
    .addServer({
      url: 'http://localhost:3000',
      description: 'Development server',
    });

  const document = builder.build();

  // Enhance the OpenAPI document with additional configurations
  return {
    ...document,
    components: {
      ...document.components,
      securitySchemes: {
        'JWT-auth': {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        TenantHeader: {
          type: 'string',
          description: 'Company identifier for multi-tenant isolation',
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            message: { type: 'string' },
            error: { type: 'string' },
          },
        },
      },
    },
    security: [{ 'JWT-auth': [] }],
    tags: [
      { name: 'Authentication', description: 'Authentication endpoints' },
      { name: 'Activities', description: 'Activity tracking endpoints' },
      { name: 'Points', description: 'Points management endpoints' },
      { name: 'Teams', description: 'Team management endpoints' },
      { name: 'Organizations', description: 'Organization management endpoints' },
      { name: 'Companies', description: 'Company management endpoints' },
      { name: 'Analytics', description: 'Analytics and reporting endpoints' },
    ],
    externalDocs: {
      description: 'CodeQuest API Additional Documentation',
      url: 'https://docs.codequest.com',
    },
  };
};

/**
 * Exports the Swagger configuration object with all required settings
 */
export const swaggerConfig: AppConfig['swagger'] = {
  enabled: true,
  title: API_TITLE,
  description: API_DESCRIPTION,
  version: API_VERSION,
  path: SWAGGER_PATH,
  tags: [
    'Authentication',
    'Activities',
    'Points',
    'Teams',
    'Organizations',
    'Companies',
    'Analytics',
  ],
  servers: [
    {
      url: 'https://api.codequest.com',
      description: 'Production',
    },
    {
      url: 'https://staging-api.codequest.com',
      description: 'Staging',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development',
    },
  ],
  securitySchemes: {
    'JWT-auth': {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
  securityRequirements: [
    {
      'JWT-auth': [],
    },
  ],
  components: {
    schemas: {
      TenantHeader: {
        type: 'string',
        description: 'Company identifier for multi-tenant isolation',
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          statusCode: { type: 'number' },
          message: { type: 'string' },
          error: { type: 'string' },
        },
      },
    },
  },
};