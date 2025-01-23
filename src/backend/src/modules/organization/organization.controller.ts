/**
 * @fileoverview Organization controller implementing secure multi-tenant organization management
 * with enhanced validation, AI detection support, and audit logging
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  CacheInterceptor,
  ParseUUIDPipe,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common'; // v10.0.0
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger'; // v7.0.0
import { AuditLogger } from '@nestjs/audit'; // v1.0.0

import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from '../../dto/organization/create-organization.dto';
import { AuthGuard } from '../../guards/auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants/roles.constants';
import { TenantContext } from '../../decorators/tenant.decorator';

/**
 * Controller handling organization-related endpoints with enhanced security and validation
 */
@Controller('organizations')
@ApiTags('organizations')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(CacheInterceptor)
@ApiSecurity('jwt')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly auditLogger: AuditLogger
  ) {}

  /**
   * Creates a new organization with point configuration and AI detection settings
   */
  @Post()
  @Roles(ROLES.COMPANY_ADMIN, ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create new organization' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Organization created successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid configuration' 
  })
  async createOrganization(
    @Body() createOrgDto: CreateOrganizationDto,
    @TenantContext() tenant: { companyId: string; userId: string }
  ) {
    try {
      const organization = await this.organizationService.createOrganization(
        createOrgDto.name,
        tenant.companyId,
        createOrgDto.pointOverrides,
        tenant.userId
      );

      await this.auditLogger.log({
        action: 'organization.create',
        actor: tenant.userId,
        target: organization.id,
        data: { dto: createOrgDto }
      });

      return organization;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Retrieves organization details with caching support
   */
  @Get(':id')
  @Roles(ROLES.COMPANY_ADMIN, ROLES.ORG_ADMIN, ROLES.DEVELOPER)
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Organization retrieved successfully' 
  })
  async getOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantContext() tenant: { companyId: string }
  ) {
    const organization = await this.organizationService.getOrganization(
      id,
      tenant.companyId
    );

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  /**
   * Updates organization point configuration with AI detection support
   */
  @Put(':id/points')
  @Roles(ROLES.COMPANY_ADMIN, ROLES.ORG_ADMIN)
  @ApiOperation({ summary: 'Update organization point configuration' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Point configuration updated successfully' 
  })
  async updatePointOverrides(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() pointConfig: {
      basePoints: {
        codeCheckIn: number;
        pullRequest: number;
        codeReview: number;
        bugFix: number;
        storyClosure: number;
      };
      aiModifier: number;
    },
    @TenantContext() tenant: { companyId: string; userId: string }
  ) {
    try {
      const organization = await this.organizationService.updatePointOverrides(
        id,
        pointConfig,
        tenant.userId
      );

      await this.auditLogger.log({
        action: 'organization.updatePoints',
        actor: tenant.userId,
        target: id,
        data: { config: pointConfig }
      });

      return organization;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Lists organizations with pagination and caching
   */
  @Get()
  @Roles(ROLES.COMPANY_ADMIN, ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List organizations' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Organizations retrieved successfully' 
  })
  async listOrganizations(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @TenantContext() tenant: { companyId: string }
  ) {
    return await this.organizationService.listOrganizations(tenant.companyId, {
      skip: skip || 0,
      take: take || 10
    });
  }

  /**
   * Deletes an organization with proper authorization checks
   */
  @Delete(':id')
  @Roles(ROLES.COMPANY_ADMIN, ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Organization deleted successfully' 
  })
  async deleteOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantContext() tenant: { companyId: string; userId: string }
  ) {
    const organization = await this.organizationService.getOrganization(
      id,
      tenant.companyId
    );

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    await this.organizationService.deleteOrganization(id);

    await this.auditLogger.log({
      action: 'organization.delete',
      actor: tenant.userId,
      target: id
    });

    return { statusCode: HttpStatus.NO_CONTENT };
  }
}