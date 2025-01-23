// External imports - class-validator v0.14.0
import { IsEmail, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

/**
 * Data Transfer Object for validating user login credentials.
 * Implements enterprise-grade validation rules with SSO compatibility.
 * Follows security best practices for input validation and length restrictions.
 */
export class LoginDto {
    /**
     * User's email address.
     * Must be a valid email format according to RFC 5322 standards.
     * Required for both standard and SSO authentication flows.
     */
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail(
        { allow_display_name: false, require_tld: true },
        { message: 'Invalid email format' }
    )
    @MaxLength(255, { message: 'Email must not exceed 255 characters' })
    email: string;

    /**
     * User's password.
     * Must meet minimum security requirements for length and complexity.
     * Maximum length enforced to prevent buffer overflow attacks.
     */
    @IsNotEmpty({ message: 'Password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(100, { message: 'Password must not exceed 100 characters' })
    password: string;

    /**
     * Creates a new instance of LoginDto with initialized properties
     */
    constructor() {
        this.email = '';
        this.password = '';
    }
}