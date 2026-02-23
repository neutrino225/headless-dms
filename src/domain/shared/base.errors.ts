/**
 * Base class for all domain errors.
 * Domain errors should NOT contain HTTP-specific concepts like status codes.
 * See multi-level error handling to to understand how errors are mapped across layers (presentation, application, domain, infrastructure)
 * map errors at boundaries (don’t forward them).
 * https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads
 */
export abstract class DomainError extends Error {
	abstract readonly code: string;

	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

export abstract class ValidationError extends DomainError {
	details?: Record<string, unknown>;
}

export class GenericDomainError extends DomainError {
	readonly code = "GENERIC_DOMAIN_ERROR";
}
export abstract class AlreadyExistsError extends DomainError {}

export abstract class InvalidOperation extends DomainError {}

export abstract class NotFoundError extends DomainError {}

export abstract class ConflictError extends DomainError {}

export abstract class UnauthorizedError extends DomainError {}

/**
 * Base class for authorization failures (HTTP 403 semantics).
 * Use for "authenticated but not authorized" scenarios.
 * UnauthorizedError is for "not authenticated" (HTTP 401).
 */
export abstract class ForbiddenError extends DomainError {}
