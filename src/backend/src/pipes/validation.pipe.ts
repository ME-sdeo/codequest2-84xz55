import { 
  PipeTransform, 
  Injectable, 
  ArgumentMetadata, 
  BadRequestException 
} from '@nestjs/common'; // ^10.0.0
import { validate } from 'class-validator'; // ^0.14.0
import { plainToInstance } from 'class-transformer'; // ^0.5.1

/**
 * Interface defining validation pipe configuration options
 */
interface ValidationPipeOptions {
  skipMissingProperties?: boolean;
  whitelist?: boolean;
  transform?: boolean;
  disableErrorMessages?: boolean;
}

/**
 * Global validation pipe that provides comprehensive validation and transformation
 * of incoming request data using class-validator and class-transformer.
 * 
 * Features:
 * - Automatic transformation of request data to DTO instances
 * - Comprehensive validation using class-validator decorators
 * - Detailed error messages with validation context
 * - Configurable validation behavior
 * - Security-focused data sanitization
 */
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  private readonly skipMissingProperties: boolean;
  private readonly whitelist: boolean;
  private readonly transform: boolean;
  private readonly disableErrorMessages: boolean;

  constructor(options: ValidationPipeOptions = {}) {
    this.skipMissingProperties = options.skipMissingProperties ?? false;
    this.whitelist = options.whitelist ?? true;
    this.transform = options.transform ?? true;
    this.disableErrorMessages = options.disableErrorMessages ?? false;
  }

  /**
   * Transforms and validates incoming request data against DTO schemas
   * 
   * @param value - The incoming request data to validate
   * @param metadata - Metadata about the target parameter
   * @returns Promise resolving to the transformed and validated data
   * @throws BadRequestException if validation fails
   */
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const { metatype } = metadata;

    // Skip validation if no metatype or validation not required
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Transform plain object to class instance
    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: this.transform,
      excludeExtraneousValues: this.whitelist,
    });

    // Validate the transformed object
    const errors = await validate(object, {
      skipMissingProperties: this.skipMissingProperties,
      whitelist: this.whitelist,
      forbidNonWhitelisted: this.whitelist,
    });

    // Process validation errors if any exist
    if (errors.length > 0) {
      if (this.disableErrorMessages) {
        throw new BadRequestException('Validation failed');
      }

      const formattedErrors = this.formatErrors(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    return object;
  }

  /**
   * Determines if validation should be performed for the given metatype
   * 
   * @param metatype - The type to check for validation
   * @returns boolean indicating if validation should be performed
   */
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Formats validation errors into a user-friendly structure
   * 
   * @param errors - Array of validation errors
   * @returns Formatted error messages
   */
  private formatErrors(errors: any[]): Record<string, string[]> {
    return errors.reduce((acc, error) => {
      const constraints = error.constraints;
      if (constraints) {
        acc[error.property] = Object.values(constraints);
      }

      // Handle nested validation errors
      if (error.children?.length > 0) {
        const nestedErrors = this.formatErrors(error.children);
        Object.keys(nestedErrors).forEach(key => {
          acc[`${error.property}.${key}`] = nestedErrors[key];
        });
      }

      return acc;
    }, {});
  }
}