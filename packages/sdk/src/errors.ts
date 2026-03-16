/**
 * Base error for all LiveClaw SDK errors.
 */
export class LiveClawError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'LiveClawError';
  }
}

/** 401 — Invalid or expired token / API key */
export class AuthenticationError extends LiveClawError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

/** 403 — Valid auth but insufficient permissions */
export class ForbiddenError extends LiveClawError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/** 404 — Resource not found */
export class NotFoundError extends LiveClawError {
  constructor(message = 'Not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/** 429 — Rate limit exceeded */
export class RateLimitError extends LiveClawError {
  constructor(message = 'Rate limited') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}
