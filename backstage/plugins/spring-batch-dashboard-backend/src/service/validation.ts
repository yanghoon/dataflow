import type { JobStatus } from '../types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate and parse a positive integer parameter
 * Strict validation - rejects strings like "10abc", "1e2", "1.5"
 */
export function validatePositiveInt(
  value: any,
  paramName: string,
  min: number = 1,
  max?: number,
): number {
  const str = String(value).trim();

  // Strict integer regex - only accepts digits with optional leading sign
  if (!/^-?\d+$/.test(str)) {
    throw new ValidationError(`${paramName} must be a valid integer`);
  }

  const parsed = parseInt(str, 10);

  if (Number.isNaN(parsed)) {
    throw new ValidationError(`${paramName} must be a valid integer`);
  }

  if (parsed < min) {
    throw new ValidationError(`${paramName} must be at least ${min}`);
  }

  if (max !== undefined && parsed > max) {
    throw new ValidationError(`${paramName} must not exceed ${max}`);
  }

  return parsed;
}

/**
 * Validate environment parameter
 * Now dynamic - accepts any string, validated against available environments at runtime
 */
export function validateEnvironment(
  value: any,
  availableEnvironments: string[],
  defaultEnvironment: string,
): string {
  if (!value) {
    return defaultEnvironment;
  }

  const env = String(value);

  if (!availableEnvironments.includes(env)) {
    throw new ValidationError(
      `environment must be one of: ${availableEnvironments.join(', ')}`,
    );
  }

  return env;
}

/**
 * Validate optional string parameter
 */
export function validateOptionalString(
  value: any,
  paramName: string,
  maxLength?: number,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const str = String(value).trim();

  if (str.length === 0) {
    return undefined;
  }

  if (maxLength && str.length > maxLength) {
    throw new ValidationError(
      `${paramName} must not exceed ${maxLength} characters`,
    );
  }

  return str;
}

/**
 * Validate date format (YYYY-MM-DD or ISO datetime)
 * Accepts both YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss formats
 * Returns YYYY-MM-DD format
 * Ensures calendar validity (rejects 2026-02-31, etc.)
 */
export function validateDate(value: any, paramName: string): string {
  if (!value) {
    throw new ValidationError(`${paramName} is required`);
  }

  const str = String(value);

  // Accept YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  // Accept ISO datetime format (YYYY-MM-DDTHH:mm:ss[.sss][Z|+09:00])
  // Anchor to end to reject invalid suffixes like "...abc"
  const isoDateTimeRegex =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/;

  let dateStr: string;

  if (dateRegex.test(str)) {
    // Already in YYYY-MM-DD format
    dateStr = str;
  } else if (isoDateTimeRegex.test(str)) {
    // ISO datetime format - extract date part
    dateStr = str.split('T')[0];
  } else {
    throw new ValidationError(
      `${paramName} must be in YYYY-MM-DD or ISO datetime format`,
    );
  }

  // Ensure calendar validity in UTC (timezone-safe)
  // This catches cases like 2026-02-31 which auto-corrects to 2026-03-03.
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    throw new ValidationError(
      `${paramName} is not a valid calendar date (e.g., ${dateStr} does not exist)`,
    );
  }

  return dateStr;
}

/**
 * Validate optional date format (YYYY-MM-DD)
 */
export function validateOptionalDate(
  value: any,
  paramName: string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return validateDate(value, paramName);
}

/**
 * Validate status parameter
 */
export function validateOptionalStatus(value: any): JobStatus | undefined {
  if (!value) {
    return undefined;
  }

  const validStatuses: JobStatus[] = [
    'STARTING',
    'STARTED',
    'STOPPING',
    'STOPPED',
    'FAILED',
    'COMPLETED',
    'ABANDONED',
    'UNKNOWN',
  ];

  const status = String(value).toUpperCase() as JobStatus;

  if (!validStatuses.includes(status)) {
    throw new ValidationError(
      `status must be one of: ${validStatuses.join(', ')}`,
    );
  }

  return status;
}

/**
 * Validate date range (from <= to)
 */
export function validateDateRange(fromDate: string, toDate: string): void {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (from > to) {
    throw new ValidationError(
      `from date (${fromDate}) must not be after to date (${toDate})`,
    );
  }
}
