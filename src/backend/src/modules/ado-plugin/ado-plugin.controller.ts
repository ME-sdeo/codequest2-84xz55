import { 
    Controller, 
    Post, 
    Body, 
    UseGuards, 
    UsePipes, 
    UseInterceptors,
    Logger,
    ValidationPipe,
    HttpStatus
} from '@nestjs/common'; // ^10.0.0
import { 
    ApiTags, 
    ApiOperation, 
    ApiResponse, 
    ApiSecurity,
    ApiBearerAuth 
} from '@nestjs/swagger'; // ^7.0.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0

import { AdoPluginService } from './ado-plugin.service';
import { CreateActivityDto } from '../../dto/activity/create-activity.dto';
import { IActivity } from '../../interfaces/activity.interface';
import { WebhookGuard } from '../../guards/webhook.guard';
import { AuthGuard } from '../../guards/auth.guard';
import { LoggingInterceptor } from '../../interceptors/logging.interceptor';
import { MetricsInterceptor } from '../../interceptors/metrics.interceptor';
import { ActivityResponse } from '../../responses/activity.response';

/**
 * Controller responsible for handling Azure DevOps webhook events
 * Implements real-time activity processing with enhanced security and monitoring
 */
@Controller('ado-plugin')
@ApiTags('Azure DevOps Plugin')
@UseGuards(AuthGuard, WebhookGuard)
@UseInterceptors(LoggingInterceptor, MetricsInterceptor)
@RateLimit({
    ttl: 60,
    limit: 100,
    message: 'Too many requests from this IP, please try again later'
})
export class AdoPluginController {
    private readonly logger: Logger;

    constructor(
        private readonly adoPluginService: AdoPluginService,
        logger: Logger
    ) {
        this.logger = logger;
        this.logger.setContext('AdoPluginController');
    }

    /**
     * Processes incoming Azure DevOps webhook events
     * Implements comprehensive validation, security checks, and monitoring
     * @param activityDto Validated activity data from ADO webhook
     * @returns Processed activity with performance metrics
     */
    @Post('webhook')
    @ApiOperation({ 
        summary: 'Process ADO webhook event',
        description: 'Handles incoming Azure DevOps activities with real-time processing'
    })
    @ApiSecurity('webhook-key')
    @ApiBearerAuth()
    @ApiResponse({ 
        status: HttpStatus.CREATED, 
        description: 'Activity processed successfully',
        type: ActivityResponse
    })
    @ApiResponse({ 
        status: HttpStatus.BAD_REQUEST, 
        description: 'Invalid webhook payload'
    })
    @ApiResponse({ 
        status: HttpStatus.TOO_MANY_REQUESTS, 
        description: 'Rate limit exceeded'
    })
    @UsePipes(new ValidationPipe({ 
        transform: true, 
        whitelist: true,
        forbidNonWhitelisted: true
    }))
    async processWebhook(
        @Body() activityDto: CreateActivityDto
    ): Promise<IActivity> {
        const correlationId = `ado_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.logger.setCorrelationId(correlationId);

        try {
            this.logger.debug('Processing ADO webhook event', {
                activityType: activityDto.type,
                teamMemberId: activityDto.teamMemberId,
                correlationId
            });

            const startTime = Date.now();

            // Process the activity through ADO plugin service
            const activity = await this.adoPluginService.processAdoEvent(
                activityDto,
                activityDto.teamMemberId,
                correlationId
            );

            const processingTime = Date.now() - startTime;

            this.logger.info('ADO webhook processed successfully', {
                activityId: activity.id,
                processingTime,
                correlationId
            });

            // Add processing metrics to response
            return {
                ...activity,
                processingTime
            };

        } catch (error) {
            this.logger.error('Failed to process ADO webhook', error, {
                correlationId,
                activityType: activityDto.type
            });

            // Attempt to retry failed events
            await this.adoPluginService.retryFailedEvent(activityDto, error);
            throw error;
        }
    }
}