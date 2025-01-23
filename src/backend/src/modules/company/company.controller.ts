/**
 * @fileoverview Company controller implementing HTTP endpoints for company management
 * Provides enhanced company operations with AI-aware point system and multi-tenant support
 * @version 1.0.0
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpException,
  ParseUUIDPipe
} from '@nestjs/common'; // ^10.0.0
import { Transaction } from '@nestjs/typeorm'; // ^10.0.0
import { CompanyService } from './company.service';
import { CreateCompanyDto } from '../../dto/company/create-company.dto';
import { ROLES } from '../../constants/roles.constants';
import { Roles } from '../../decorators/roles.decorator';
import { AuthGuard } from '../../guards/auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { CompanyEntity } from '../../entities/company.entity';
import { PointConfig } from '../../interfaces/tenant.interface';
import { AuditLog } from '../../decorators/audit-log.decorator';
import { RateLimit } from '../../decorators/rate-limit.decorator';

/**
 * Controller handling HTTP endpoints for company management with AI-aware point system
 */
@Controller('companies')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  /**
   * Creates a new company tenant with initial point configuration
   * @param createCompanyDto - Company creation data with point configuration
   * @returns Promise resolving to created company entity
   */
  @Post()
  @Roles(ROLES.SUPER_ADMIN)
  @Transaction()
  @AuditLog('company.create')
  @RateLimit({ ttl: 3600, limit: 10 })
  async createCompany(
    @Body() createCompanyDto: CreateCompanyDto
  ): Promise<CompanyEntity> {
    try {
      return await this.companyService.createCompany(createCompanyDto);
    } catch (error) {
      throw new HttpException(
        `Failed to create company: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Retrieves company details by ID with organization data
   * @param id - Company UUID
   * @returns Promise resolving to company entity with organizations
   */
  @Get(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  async getCompanyById(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<CompanyEntity> {
    try {
      const company = await this.companyService.getCompanyWithOrganizations(id, {
        loadOrganizations: true
      });
      
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }
      
      return company;
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve company: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Updates company point configuration with AI detection support
   * @param id - Company UUID
   * @param pointConfig - New point configuration with AI modifiers
   * @returns Promise resolving to updated company entity
   */
  @Put(':id/point-config')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  @Transaction()
  @AuditLog('company.update_point_config')
  @RateLimit({ ttl: 3600, limit: 100 })
  async updatePointConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() pointConfig: PointConfig
  ): Promise<CompanyEntity> {
    try {
      // Validate point configuration
      const isValid = await this.companyService.validatePointConfiguration(
        pointConfig
      );
      
      if (!isValid) {
        throw new Error('Invalid point configuration');
      }

      // Update point configuration with AI modifiers
      const company = await this.companyService.updatePointConfig(
        id,
        pointConfig
      );

      // Update AI point modifiers
      await this.companyService.updateAIPointModifiers(
        id,
        pointConfig.aiModifier
      );

      return company;
    } catch (error) {
      throw new HttpException(
        `Failed to update point configuration: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Retrieves company details with full organization hierarchy
   * @param id - Company UUID
   * @returns Promise resolving to company with full organization data
   */
  @Get(':id/organizations')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  async getCompanyWithOrganizations(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<CompanyEntity> {
    try {
      const company = await this.companyService.getCompanyWithOrganizations(id, {
        loadOrganizations: true,
        loadTeams: true
      });
      
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }
      
      return company;
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve company data: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }
}