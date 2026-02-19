/**
 * Shared constants used across the application.
 */

/** Supabase storage bucket for COI documents */
export const STORAGE_BUCKET = process.env.COI_STORAGE_BUCKET || 'coi-docs-dev';

/** Maximum file upload size in bytes (4MB) */
export const MAX_FILE_SIZE = 4 * 1024 * 1024;

// -------------------------------------------------------
// COI Grader
// -------------------------------------------------------

/** Maximum grader file upload size in bytes (10MB) */
export const GRADER_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Accepted MIME types for the grader */
export const GRADER_ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

/** Max grader uploads per IP-hash in a 24-hour window */
export const GRADER_RATE_LIMIT = 5;
