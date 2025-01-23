import { Injectable, Logger } from '@nestjs/common'; // ^10.0.0
import { WebApi } from 'azure-devops-node-api'; // ^12.0.0
import { retry } from 'retry'; // ^0.13.1
import CircuitBreaker from 'opossum'; // ^6.0.0

import { IActivity, ActivityType } from '../../interfaces/activity.interface';
import { ActivityService } from '../activity/activity.service';
import { AiDetectionService } from '../../services/ai-detection.service';

@Injectable()
export class AdoPluginService {
    private readonly logger: Logger;
    private readonly adoClient: WebApi;
    private readonly circuitBreaker: CircuitBreaker;
    private readonly retryOptions = {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000
    };

    constructor(
        private readonly activityService: ActivityService,
        private readonly aiDetectionService: AiDetectionService
    ) {
        this.logger = new Logger('AdoPluginService');
        this.initializeAdoClient();
        this.initializeCircuitBreaker();
    }

    /**
     * Initializes Azure DevOps API client with authentication
     */
    private initializeAdoClient(): void {
        const pat = process.env.ADO_PAT;
        const orgUrl = process.env.ADO_ORG_URL;

        if (!pat || !orgUrl) {
            throw new Error('Azure DevOps configuration missing');
        }

        this.adoClient = new WebApi(orgUrl, {
            headers: {
                'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
            }
        });
    }

    /**
     * Initializes circuit breaker for ADO API calls
     */
    private initializeCircuitBreaker(): void {
        this.circuitBreaker = new CircuitBreaker(async (fn: Function) => await fn(), {
            timeout: 5000, // 5 second timeout for real-time requirement
            errorThresholdPercentage: 50,
            resetTimeout: 30000
        });

        this.circuitBreaker.on('open', () => {
            this.logger.warn('Circuit breaker opened for ADO API calls');
        });

        this.circuitBreaker.on('halfOpen', () => {
            this.logger.log('Circuit breaker half-open, testing ADO API calls');
        });

        this.circuitBreaker.on('close', () => {
            this.logger.log('Circuit breaker closed, ADO API calls restored');
        });
    }

    /**
     * Processes incoming Azure DevOps webhook events with comprehensive error handling
     * @param eventPayload Webhook event payload from ADO
     * @param tenantId Tenant identifier for isolation
     * @param correlationId Request correlation ID for tracing
     * @returns Processed activity record
     */
    async processAdoEvent(
        eventPayload: any,
        tenantId: string,
        correlationId: string
    ): Promise<IActivity> {
        this.logger.debug('Processing ADO event', {
            eventType: eventPayload.eventType,
            tenantId,
            correlationId
        });

        try {
            // Validate event payload
            await this.validateAdoEvent(eventPayload, tenantId);

            // Extract activity data with tenant context
            const activityData = await this.extractActivityData(eventPayload, tenantId);

            // Detect AI-generated code
            const isAiGenerated = await this.circuitBreaker.fire(
                () => this.aiDetectionService.detectAiGenerated(activityData)
            );

            // Create activity with retry mechanism
            const operation = retry.operation(this.retryOptions);
            return new Promise((resolve, reject) => {
                operation.attempt(async () => {
                    try {
                        const activity = await this.activityService.createActivity({
                            ...activityData,
                            isAiGenerated,
                            correlationId
                        });
                        resolve(activity);
                    } catch (error) {
                        if (operation.retry(error)) {
                            return;
                        }
                        reject(operation.mainError());
                    }
                });
            });

        } catch (error) {
            this.logger.error('Failed to process ADO event', error, {
                tenantId,
                correlationId,
                eventType: eventPayload.eventType
            });
            throw error;
        }
    }

    /**
     * Extracts and validates activity data from ADO event payload
     * @param eventPayload ADO webhook event payload
     * @param tenantId Tenant identifier
     * @returns Validated activity data
     */
    private async extractActivityData(
        eventPayload: any,
        tenantId: string
    ): Promise<IActivity> {
        const { eventType, resource } = eventPayload;

        // Map ADO event type to activity type
        const activityType = this.mapEventTypeToActivity(eventType);
        if (!activityType) {
            throw new Error(`Unsupported event type: ${eventType}`);
        }

        // Extract metadata with security checks
        const metadata = {
            adoId: resource.id,
            repository: resource.repository?.name,
            branch: resource.refUpdates?.[0]?.name || resource.sourceBranch,
            url: resource._links?.web?.href,
            title: resource.title || resource.message,
            description: resource.description || resource.comment,
            size: this.calculateSize(resource),
            complexity: await this.calculateComplexity(resource),
            tags: resource.tags || [],
            aiConfidence: 0
        };

        return {
            id: undefined, // Will be set by activity service
            type: activityType,
            teamMemberId: resource.createdBy?.id,
            points: 0, // Will be calculated by activity service
            isAiGenerated: false, // Will be set after AI detection
            metadata,
            tenantId,
            correlationId: undefined // Will be set during processing
        };
    }

    /**
     * Validates ADO event payload with security checks
     * @param eventPayload Event payload to validate
     * @param tenantId Tenant identifier
     * @returns boolean indicating if event is valid
     */
    private async validateAdoEvent(
        eventPayload: any,
        tenantId: string
    ): Promise<boolean> {
        if (!eventPayload || !eventPayload.eventType) {
            throw new Error('Invalid event payload');
        }

        if (!tenantId) {
            throw new Error('Tenant ID is required');
        }

        // Validate event signature if provided
        if (process.env.ADO_WEBHOOK_SECRET) {
            const signature = eventPayload.signature;
            if (!this.validateEventSignature(signature, eventPayload)) {
                throw new Error('Invalid event signature');
            }
        }

        return true;
    }

    /**
     * Maps ADO event types to internal activity types
     * @param eventType ADO event type
     * @returns Mapped activity type
     */
    private mapEventTypeToActivity(eventType: string): ActivityType {
        const eventMap: Record<string, ActivityType> = {
            'git.push': ActivityType.CODE_CHECKIN,
            'git.pullrequest.created': ActivityType.PULL_REQUEST,
            'git.pullrequest.reviewed': ActivityType.CODE_REVIEW,
            'workitem.updated': ActivityType.BUG_FIX,
            'workitem.completed': ActivityType.STORY_CLOSURE
        };

        return eventMap[eventType];
    }

    /**
     * Calculates size metric for activity
     * @param resource ADO resource data
     * @returns Calculated size value
     */
    private calculateSize(resource: any): number {
        if (resource.changes) {
            return resource.changes.reduce((total: number, change: any) => {
                return total + (change.additions || 0) + (change.deletions || 0);
            }, 0);
        }
        return 0;
    }

    /**
     * Calculates complexity metric for activity
     * @param resource ADO resource data
     * @returns Calculated complexity value
     */
    private async calculateComplexity(resource: any): Promise<number> {
        try {
            if (resource.changes) {
                // Basic complexity calculation based on changes
                const changeComplexity = resource.changes.length;
                const fileComplexity = new Set(
                    resource.changes.map((c: any) => c.path)
                ).size;
                return Math.min(10, (changeComplexity + fileComplexity) / 2);
            }
            return 1;
        } catch (error) {
            this.logger.warn('Failed to calculate complexity', error);
            return 1;
        }
    }

    /**
     * Validates webhook event signature
     * @param signature Event signature
     * @param payload Event payload
     * @returns boolean indicating if signature is valid
     */
    private validateEventSignature(signature: string, payload: any): boolean {
        const crypto = require('crypto');
        const secret = process.env.ADO_WEBHOOK_SECRET;
        const hmac = crypto.createHmac('sha1', secret);
        const digest = hmac.update(JSON.stringify(payload)).digest('hex');
        return signature === `sha1=${digest}`;
    }
}