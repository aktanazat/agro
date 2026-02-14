import { JSONValue } from './common';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PLAYBOOK_PATCH_PATH_NOT_ALLOWED'
  | 'PLAYBOOK_VERSION_MISMATCH'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  traceId: string;
  details?: Record<string, JSONValue>;
}

export interface ErrorEnvelope {
  requestId: string;
  timestamp: string;
  error: ErrorBody;
}
