/**
 * @fileoverview Organization module implementing multi-tenant organization management
 * with enhanced point configuration and AI detection support
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // v10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // v10.0.0

import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from '../../repositories/organization.repository';
import { OrganizationEntity } from '../../entities/organization.entity';
import { CompanyEntity } from '../../entities/company.entity';

/**
 * Module configuring organization management with multi-tenant support
 * Implements organization-level point configuration and team hierarchy
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      CompanyEntity,
      OrganizationRepository
    ])
  ],
  controllers: [OrganizationController],
  providers: [
    OrganizationService,
    {
      provide: 'CACHE_TTL',
      useValue: 30000 // 30 seconds cache TTL for organization data
    },
    {
      provide: 'MAX_ORGANIZATIONS',
      useValue: {
        SMALL: 1,
        MEDIUM: 5,
        ENTERPRISE: 100
      }
    }
  ],
  exports: [
    OrganizationService,
    TypeOrmModule.forFeature([OrganizationEntity])
  ]
})
export class OrganizationModule {}