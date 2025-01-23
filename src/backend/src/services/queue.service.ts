// @nestjs/common v10.0.0
import { Injectable } from '@nestjs/common';
// bull v4.10.0
import { Queue, Job, JobOptions } from 'bull';
// @nestjs/bull v10.0.0
import { InjectQueue } from '@nestjs/bull';
// Internal imports
import { QueueConfig } from '../interfaces/config.interface';
import { LoggerService } from './logger.service';

// Queue metric types
interface QueueMetrics {
  processed: number;
  failed: number;
  delayed: number;
  processingTime: number[];
}

// Activity data interface
interface ActivityData {
  id: string;
  type: string;
  userId: string;
  tenantId: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

@Injectable()
export class QueueService {
  private readonly maxRetries = 3;
  private readonly backoffDelay = 1000;
  private readonly queueMetrics: Record<string, QueueMetrics> = {};

  constructor(
    @InjectQueue('activities') private readonly activityQueue: Queue,
    @InjectQueue('points') private readonly pointsQueue: Queue,
    @InjectQueue('analytics') private readonly analyticsQueue: Queue,
    private readonly logger: LoggerService
  ) {
    this.initializeQueues();
    this.setupQueueMonitoring();
  }

  /**
   * Initializes all queues with proper configuration and error handling
   */
  private initializeQueues(): void {
    const queues = [
      { queue: this.activityQueue, name: 'activities' },
      { queue: this.pointsQueue, name: 'points' },
      { queue: this.analyticsQueue, name: 'analytics' }
    ];

    queues.forEach(({ queue, name }) => {
      this.queueMetrics[name] = {
        processed: 0,
        failed: 0,
        delayed: 0,
        processingTime: []
      };

      // Setup error handling
      queue.on('error', (error) => {
        this.logger.error(`Queue ${name} error`, error, { queueName: name });
      });

      // Setup stalled job handling
      queue.on('stalled', (jobId) => {
        this.logger.warn(`Job ${jobId} stalled in queue ${name}`, { queueName: name, jobId });
      });
    });
  }

  /**
   * Sets up monitoring and metrics collection for all queues
   */
  private setupQueueMonitoring(): void {
    const queues = [this.activityQueue, this.pointsQueue, this.analyticsQueue];

    queues.forEach(queue => {
      queue.on('completed', (job: Job, result: any) => {
        const metrics = this.queueMetrics[job.queue.name];
        metrics.processed++;
        metrics.processingTime.push(Date.now() - job.timestamp);
        
        // Keep only last 100 processing times
        if (metrics.processingTime.length > 100) {
          metrics.processingTime.shift();
        }
      });

      queue.on('failed', (job: Job, error: Error) => {
        const metrics = this.queueMetrics[job.queue.name];
        metrics.failed++;
        this.logger.error(`Job failed in queue ${job.queue.name}`, error, {
          jobId: job.id,
          queueName: job.queue.name,
          attemptsMade: job.attemptsMade
        });
      });
    });
  }

  /**
   * Adds a new activity to the processing queue with priority and tenant isolation
   * @param activityData Activity data to be processed
   * @param priority Priority level for processing
   * @param tenantId Tenant identifier for isolation
   * @returns Promise resolving to the created job
   */
  async addActivityToQueue(
    activityData: ActivityData,
    priority: number = 5,
    tenantId: string
  ): Promise<Job<ActivityData>> {
    this.logger.setTenantId(tenantId);
    const correlationId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.setCorrelationId(correlationId);

    const jobOptions: JobOptions = {
      priority,
      attempts: this.maxRetries,
      backoff: {
        type: 'exponential',
        delay: this.backoffDelay
      },
      removeOnComplete: true,
      jobId: correlationId,
      timeout: 5000, // 5 second timeout for real-time requirement
    };

    try {
      const job = await this.activityQueue.add(
        `${tenantId}:activity`,
        {
          ...activityData,
          correlationId,
          tenantId
        },
        jobOptions
      );

      this.logger.info('Activity added to queue', {
        jobId: job.id,
        priority,
        tenantId,
        activityType: activityData.type
      });

      return job;
    } catch (error) {
      this.logger.error('Failed to add activity to queue', error as Error, {
        tenantId,
        activityType: activityData.type
      });
      throw error;
    }
  }

  /**
   * Retrieves detailed status of all queues including metrics and health
   * @returns Promise resolving to queue status information
   */
  async getQueueStatus(): Promise<Record<string, any>> {
    const queues = [
      { queue: this.activityQueue, name: 'activities' },
      { queue: this.pointsQueue, name: 'points' },
      { queue: this.analyticsQueue, name: 'analytics' }
    ];

    const status: Record<string, any> = {};

    for (const { queue, name } of queues) {
      const [
        jobCounts,
        isPaused,
        workers
      ] = await Promise.all([
        queue.getJobCounts(),
        queue.isPaused(),
        queue.getWorkers()
      ]);

      const metrics = this.queueMetrics[name];
      const avgProcessingTime = metrics.processingTime.length > 0
        ? metrics.processingTime.reduce((a, b) => a + b, 0) / metrics.processingTime.length
        : 0;

      status[name] = {
        jobCounts,
        metrics: {
          processed: metrics.processed,
          failed: metrics.failed,
          delayed: metrics.delayed,
          averageProcessingTime: Math.round(avgProcessingTime)
        },
        health: {
          isPaused,
          workerCount: workers.length,
          isHealthy: !isPaused && workers.length > 0
        }
      };
    }

    return status;
  }
}