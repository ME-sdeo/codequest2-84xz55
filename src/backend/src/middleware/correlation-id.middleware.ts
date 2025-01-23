// @nestjs/common v10.0.0
import { Injectable, NestMiddleware } from '@nestjs/common';
// express v4.18.0
import { Request, Response, NextFunction } from 'express';
// uuid v9.0.0
import { v4 as uuidv4 } from 'uuid';
// Internal imports
import { LoggerService } from '../services/logger.service';

/**
 * W3C Trace Context headers and formats
 * @see https://www.w3.org/TR/trace-context/
 */
const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const TRACE_PARENT_HEADER = 'traceparent';
const TRACE_STATE_HEADER = 'tracestate';
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRACE_PARENT_REGEX = /^00-[a-f0-9]{32}-[a-f0-9]{16}-[0-9a-f]{2}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
    private readonly headerValidationRegex: RegExp;

    constructor(private readonly logger: LoggerService) {
        this.headerValidationRegex = UUID_V4_REGEX;
    }

    /**
     * Validates the correlation ID format
     * @param correlationId - The correlation ID to validate
     * @returns boolean indicating if the correlation ID is valid
     */
    private validateCorrelationId(correlationId: string): boolean {
        if (!correlationId) {
            return false;
        }
        return this.headerValidationRegex.test(correlationId);
    }

    /**
     * Generates a W3C trace context compliant traceparent header
     * @param correlationId - The correlation ID to include in the trace
     * @returns string representing the traceparent header
     */
    private generateTraceParent(correlationId: string): string {
        const version = '00';
        const traceId = correlationId.replace(/-/g, '');
        const spanId = uuidv4().replace(/-/g, '').substring(0, 16);
        const flags = '01'; // Sampled
        return `${version}-${traceId}-${spanId}-${flags}`;
    }

    /**
     * Extracts correlation ID from traceparent if present
     * @param traceparent - The traceparent header value
     * @returns string | null - Extracted correlation ID or null
     */
    private extractFromTraceParent(traceparent: string): string | null {
        if (!traceparent || !TRACE_PARENT_REGEX.test(traceparent)) {
            return null;
        }
        const [, traceId] = traceparent.split('-');
        return `${traceId.slice(0, 8)}-${traceId.slice(8, 12)}-${traceId.slice(12, 16)}-${traceId.slice(16, 20)}-${traceId.slice(20)}`;
    }

    /**
     * Middleware implementation for correlation ID handling
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next function
     */
    use(req: Request, res: Response, next: NextFunction): void {
        try {
            let correlationId: string | null = null;

            // Check for existing correlation ID
            const existingCorrelationId = req.header(CORRELATION_ID_HEADER);
            const existingTraceParent = req.header(TRACE_PARENT_HEADER);

            if (existingCorrelationId && this.validateCorrelationId(existingCorrelationId)) {
                correlationId = existingCorrelationId;
            } else if (existingTraceParent) {
                correlationId = this.extractFromTraceParent(existingTraceParent);
            }

            // Generate new correlation ID if none exists or invalid
            if (!correlationId) {
                correlationId = uuidv4();
            }

            // Set correlation ID in request context
            req['correlationId'] = correlationId;

            // Set response headers
            res.setHeader(CORRELATION_ID_HEADER, correlationId);
            res.setHeader(TRACE_PARENT_HEADER, this.generateTraceParent(correlationId));
            
            // Preserve existing trace state or initialize new one
            const traceState = req.header(TRACE_STATE_HEADER) || `codequest=${correlationId}`;
            res.setHeader(TRACE_STATE_HEADER, traceState);

            // Set correlation ID in logger
            this.logger.setCorrelationId(correlationId);

            // Log request with correlation ID
            this.logger.debug('Request received', {
                method: req.method,
                url: req.url,
                correlationId,
                userAgent: req.header('user-agent'),
                clientIp: req.ip
            });

            // Handle response completion
            res.on('finish', () => {
                this.logger.debug('Response sent', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    correlationId
                });
            });

            next();
        } catch (error) {
            // Log error and continue processing
            this.logger.error('Error in correlation ID middleware', error, {
                method: req.method,
                url: req.url
            });
            next();
        }
    }
}