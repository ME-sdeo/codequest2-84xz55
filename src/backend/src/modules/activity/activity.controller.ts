import { 
    Controller, 
    Post, 
    Get, 
    Body, 
    Query, 
    UseGuards, 
    ValidationPipe, 
    UseInterceptors,
    Headers,
    Logger,
    ParseUUIDPipe,
    Param,
    HttpStatus
} from '@nestjs/common'; // ^10.0.0
import { 
    ApiTags, 
    ApiOperation, 
    ApiResponse, 
    ApiHeader,
    ApiBearerAuth 
} from '@nestjs/swagger'; // ^7.0.0
import { ActivityService } from './activity.service';
import { CreateActivityDto } from '../../dto/activity/create-activity.dto';
import { AuthGuard } from '../../guards/auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { RoleGuard } from '../../guards/role.guard';
import { LoggingInterceptor } from '../../interceptors/logging.interceptor';
import { PerformanceInterceptor } from '../../interceptors/performance.interceptor';
import { CacheInterceptor } from '../../interceptors/cache.interceptor';
import { Roles } from '../../decorators/roles.decorator';
import { IActivity } from '../../interfaces/activity.interface';

/**
 * Controller handling HTTP endpoints for Azure DevOps activity management
 * Implements comprehensive activity tracking with enhanced security and monitoring
 */
@Controller('activities')
@UseGuards(AuthGuard, TenantGuard)
@ApiTags('Activities')
@ApiBearerAuth()
@UseInterceptors(LoggingInterceptor, PerformanceInterceptor)
export class ActivityController {
    constructor(
        private readonly activityService: ActivityService,
        private readonly logger: Logger
    ) {
        this.logger.setContext('ActivityController');
    }

    /**
     * Creates a new activity from Azure DevOps with enhanced validation and AI detection
     * @param createActivityDto Activity creation data
     * @param tenantId Tenant identifier for isolation
     * @returns Created activity with points and metadata
     */
    @Post()
    @UseGuards(RoleGuard)
    @Roles(['developer', 'admin'])
    @ApiOperation({ summary: 'Create new activity' })
    @ApiResponse({ 
        status: HttpStatus.CREATED, 
        description: 'Activity created successfully',
        type: IActivity 
    })
    @ApiResponse({ 
        status: HttpStatus.BAD_REQUEST, 
        description: 'Invalid input data' 
    })
    @ApiHeader({ 
        name: 'x-tenant-id', 
        description: 'Tenant identifier' 
    })
    async createActivity(
        @Body(new ValidationPipe({ transform: true })) createActivityDto: CreateActivityDto,
        @Headers('x-tenant-id') tenantId: string
    ): Promise<IActivity> {
        this.logger.debug('Creating new activity', {
            tenantId,
            activityType: createActivityDto.type,
            teamMemberId: createActivityDto.teamMemberId
        });

        try {
            const activity = await this.activityService.createActivity({
                ...createActivityDto,
                tenantId,
                createdAt: new Date()
            });

            this.logger.info('Activity created successfully', {
                activityId: activity.id,
                type: activity.type,
                points: activity.points
            });

            return activity;
        } catch (error) {
            this.logger.error('Failed to create activity', error, {
                tenantId,
                activityType: createActivityDto.type
            });
            throw error;
        }
    }

    /**
     * Retrieves activities for a specific team member with pagination and caching
     * @param teamMemberId Team member UUID
     * @param options Pagination and filtering options
     * @returns Paginated list of team member activities
     */
    @Get('team-member/:id')
    @UseGuards(RoleGuard)
    @Roles(['developer', 'admin'])
    @UseInterceptors(CacheInterceptor)
    @ApiOperation({ summary: 'Get team member activities' })
    @ApiResponse({ 
        status: HttpStatus.OK, 
        description: 'Activities retrieved successfully',
        type: [IActivity]
    })
    async getTeamMemberActivities(
        @Param('id', new ParseUUIDPipe()) teamMemberId: string,
        @Query('skip') skip?: number,
        @Query('take') take?: number,
        @Query('startDate') startDate?: Date,
        @Query('endDate') endDate?: Date
    ): Promise<{ activities: IActivity[]; total: number }> {
        this.logger.debug('Retrieving team member activities', {
            teamMemberId,
            skip,
            take,
            startDate,
            endDate
        });

        try {
            const result = await this.activityService.getTeamMemberActivities(
                teamMemberId,
                { skip, take, startDate, endDate }
            );

            this.logger.info('Team member activities retrieved', {
                teamMemberId,
                totalActivities: result.total
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to retrieve team member activities', error, {
                teamMemberId
            });
            throw error;
        }
    }

    /**
     * Retrieves activities within a date range with enhanced query optimization
     * @param startDate Start date for range query
     * @param endDate End date for range query
     * @returns Filtered activities within date range
     */
    @Get('date-range')
    @UseGuards(RoleGuard)
    @Roles(['admin'])
    @UseInterceptors(CacheInterceptor)
    @ApiOperation({ summary: 'Get activities by date range' })
    @ApiResponse({ 
        status: HttpStatus.OK, 
        description: 'Activities retrieved successfully',
        type: [IActivity]
    })
    async getActivitiesByDateRange(
        @Query('startDate') startDate: Date,
        @Query('endDate') endDate: Date,
        @Query('skip') skip?: number,
        @Query('take') take?: number
    ): Promise<IActivity[]> {
        this.logger.debug('Retrieving activities by date range', {
            startDate,
            endDate,
            skip,
            take
        });

        try {
            const activities = await this.activityService.getActivitiesByDateRange(
                startDate,
                endDate,
                { skip, take }
            );

            this.logger.info('Activities retrieved by date range', {
                totalActivities: activities.length,
                startDate,
                endDate
            });

            return activities;
        } catch (error) {
            this.logger.error('Failed to retrieve activities by date range', error, {
                startDate,
                endDate
            });
            throw error;
        }
    }
}