export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'

const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  BAD_REQUEST: 400,
  RATE_LIMITED: 429,
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = HTTP_STATUS_MAP[code]
    this.details = details
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    }
  }
}

/**
 * Factory functions for common errors.
 */
export const Errors = {
  unauthorized(message = 'Authentication required') {
    return new AppError('UNAUTHORIZED', message)
  },

  forbidden(message = 'Insufficient permissions') {
    return new AppError('FORBIDDEN', message)
  },

  notFound(resource = 'Resource') {
    return new AppError('NOT_FOUND', `${resource} not found`)
  },

  validation(message: string, details?: Record<string, unknown>) {
    return new AppError('VALIDATION_ERROR', message, details)
  },

  conflict(message: string) {
    return new AppError('CONFLICT', message)
  },

  internal(message = 'An unexpected error occurred') {
    return new AppError('INTERNAL_ERROR', message)
  },

  badRequest(message: string) {
    return new AppError('BAD_REQUEST', message)
  },

  rateLimited(message = 'Too many requests') {
    return new AppError('RATE_LIMITED', message)
  },
} as const
