import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm'; // ^0.3.0
import { ActivityType, IActivityMetadata, ACTIVITY_BASE_POINTS } from '../interfaces/activity.interface';

@Entity()
@Index(['teamMemberId'], { name: 'IDX_ACTIVITY_TEAM_MEMBER' })
@Index(['type'], { name: 'IDX_ACTIVITY_TYPE' })
@Index(['createdAt'], { name: 'IDX_ACTIVITY_CREATED_AT' })
export class Activity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    teamMemberId: string;

    @Column({
        type: 'enum',
        enum: ActivityType,
    })
    type: ActivityType;

    @Column('integer')
    points: number;

    @Column('boolean', { default: false })
    isAiGenerated: boolean;

    @Column('jsonb')
    metadata: IActivityMetadata;

    @CreateDateColumn()
    createdAt: Date;

    constructor(data?: Partial<Activity>) {
        if (data) {
            Object.assign(this, data);
            
            // Initialize metadata with default values if not provided
            this.metadata = {
                adoId: data.metadata?.adoId || '',
                repository: data.metadata?.repository || '',
                branch: data.metadata?.branch || '',
                url: data.metadata?.url || '',
                title: data.metadata?.title || '',
                description: data.metadata?.description || '',
                size: data.metadata?.size || 0,
                complexity: data.metadata?.complexity || 0,
                tags: data.metadata?.tags || [],
                aiConfidence: data.metadata?.aiConfidence || 0
            };

            // Calculate initial points if not provided
            if (!data.points) {
                this.points = this.calculatePoints();
            }
        }
    }

    /**
     * Calculates points for the activity based on type, AI status, and complexity
     * @returns {number} Calculated points value
     */
    calculatePoints(): number {
        // Get base configuration for activity type
        const config = ACTIVITY_BASE_POINTS[this.type];
        if (!config) {
            throw new Error(`Invalid activity type: ${this.type}`);
        }

        let points = config.basePoints;

        // Apply AI modifier if applicable
        if (this.isAiGenerated) {
            points *= config.aiModifier;
        }

        // Apply complexity modifier (1-20% bonus based on complexity)
        const complexityModifier = 1 + (Math.min(this.metadata.complexity, 10) / 50);
        points *= complexityModifier;

        // Apply size modifier (1-30% bonus based on size)
        const sizeModifier = 1 + (Math.min(this.metadata.size, 1000) / 3333);
        points *= sizeModifier;

        // Round to nearest integer
        return Math.round(points);
    }
}