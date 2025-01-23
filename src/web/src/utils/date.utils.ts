/**
 * @fileoverview Comprehensive date utility functions for the CodeQuest frontend application.
 * Provides standardized date manipulation, formatting, parsing, and validation with support
 * for real-time updates and historical data analysis.
 * @version 1.0.0
 */

import { format, parseISO, isValid } from 'date-fns'; // v2.30.0
import { BaseEntity } from '../types/common.types';

/**
 * Default format strings for consistent date formatting across the application
 */
export const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_TIME_FORMAT = 'HH:mm:ss';
export const DEFAULT_DATETIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';

/**
 * Thresholds for relative time calculations in seconds
 */
export const RELATIVE_TIME_THRESHOLDS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
} as const;

/**
 * Formats a date into a standardized string representation with comprehensive error handling.
 * @param date - The date to format (Date object, ISO string, or timestamp)
 * @param formatString - The desired format pattern (defaults to DEFAULT_DATETIME_FORMAT)
 * @returns Formatted date string or empty string if invalid
 */
export const formatDate = (
  date: Date | string | number,
  formatString: string = DEFAULT_DATETIME_FORMAT
): string => {
  try {
    const dateObj = date instanceof Date ? date : parseISO(date.toString());
    
    if (!isValid(dateObj)) {
      console.warn(`Invalid date provided: ${date}`);
      return '';
    }

    return format(dateObj, formatString);
  } catch (error) {
    console.warn(`Error formatting date: ${error}`);
    return '';
  }
};

/**
 * Parses a date string into a Date object with strict validation.
 * @param dateString - The date string to parse
 * @returns Parsed Date object or null if invalid
 */
export const parseDate = (dateString: string): Date | null => {
  try {
    const parsedDate = parseISO(dateString);
    
    if (!isValid(parsedDate)) {
      console.warn(`Invalid date string provided: ${dateString}`);
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.warn(`Error parsing date: ${error}`);
    return null;
  }
};

/**
 * Calculates and returns a human-readable relative time string.
 * Supports real-time updates with millisecond precision.
 * @param date - The date to calculate relative time from
 * @returns Localized relative time string
 */
export const getRelativeTime = (date: Date | string | number): string => {
  try {
    const dateObj = date instanceof Date ? date : parseISO(date.toString());
    
    if (!isValid(dateObj)) {
      console.warn(`Invalid date provided for relative time: ${date}`);
      return '';
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    const absDiff = Math.abs(diffInSeconds);

    // Handle future dates
    const isFuture = diffInSeconds < 0;

    if (absDiff < RELATIVE_TIME_THRESHOLDS.MINUTE) {
      return 'just now';
    } else if (absDiff < RELATIVE_TIME_THRESHOLDS.HOUR) {
      const minutes = Math.floor(absDiff / RELATIVE_TIME_THRESHOLDS.MINUTE);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ${isFuture ? 'from now' : 'ago'}`;
    } else if (absDiff < RELATIVE_TIME_THRESHOLDS.DAY) {
      const hours = Math.floor(absDiff / RELATIVE_TIME_THRESHOLDS.HOUR);
      return `${hours} hour${hours !== 1 ? 's' : ''} ${isFuture ? 'from now' : 'ago'}`;
    } else if (absDiff < RELATIVE_TIME_THRESHOLDS.WEEK) {
      const days = Math.floor(absDiff / RELATIVE_TIME_THRESHOLDS.DAY);
      return `${days} day${days !== 1 ? 's' : ''} ${isFuture ? 'from now' : 'ago'}`;
    }

    return formatDate(dateObj, DEFAULT_DATE_FORMAT);
  } catch (error) {
    console.warn(`Error calculating relative time: ${error}`);
    return '';
  }
};

/**
 * Validates if a date falls within a specified range with strict boundary checking.
 * @param date - The date to check
 * @param startDate - The start of the range
 * @param endDate - The end of the range
 * @returns True if date is within range, inclusive of boundaries
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  try {
    if (!isValid(date) || !isValid(startDate) || !isValid(endDate)) {
      console.warn('Invalid date provided for range check');
      return false;
    }

    if (startDate > endDate) {
      console.warn('Start date must be before end date');
      return false;
    }

    const timestamp = date.getTime();
    return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
  } catch (error) {
    console.warn(`Error checking date range: ${error}`);
    return false;
  }
};

/**
 * Creates a standardized string representation of a date range.
 * @param startDate - The start of the range
 * @param endDate - The end of the range
 * @returns Formatted date range string
 */
export const formatDateRange = (startDate: Date, endDate: Date): string => {
  try {
    if (!isValid(startDate) || !isValid(endDate)) {
      console.warn('Invalid dates provided for range formatting');
      return '';
    }

    if (startDate > endDate) {
      console.warn('Start date must be before end date');
      return '';
    }

    // Check if dates are on the same day
    const sameDay = startDate.toDateString() === endDate.toDateString();
    
    if (sameDay) {
      return `${formatDate(startDate, DEFAULT_DATE_FORMAT)} ${formatDate(startDate, DEFAULT_TIME_FORMAT)} - ${formatDate(endDate, DEFAULT_TIME_FORMAT)}`;
    }

    return `${formatDate(startDate, DEFAULT_DATETIME_FORMAT)} - ${formatDate(endDate, DEFAULT_DATETIME_FORMAT)}`;
  } catch (error) {
    console.warn(`Error formatting date range: ${error}`);
    return '';
  }
};

/**
 * Type guard to check if an object is a BaseEntity with valid dates
 * @param obj - Object to check
 * @returns True if object is a BaseEntity with valid dates
 */
export const isValidBaseEntity = (obj: any): obj is BaseEntity => {
  return (
    obj &&
    obj.createdAt instanceof Date &&
    obj.updatedAt instanceof Date &&
    isValid(obj.createdAt) &&
    isValid(obj.updatedAt)
  );
};