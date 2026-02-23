/**
 * Maps domain errors to oRPC errors at the presentation boundary.
 *
 * Domain errors carry a `code` string but no HTTP semantics.
 * This module translates them into ORPCError instances with the
 * appropriate RPC error code.
 *
 * Security: internal error details are never exposed to clients.
 * The catch-all returns a generic message.
 */

import {
	ConflictError,
	DomainError,
	ForbiddenError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "@domain/shared/base.errors";
import { ORPCError } from "@orpc/server";

/**
 * Convert a domain (or unknown) error into an ORPCError.
 *
 * Mapping:
 *  - NotFoundError     → NOT_FOUND
 *  - ForbiddenError    → FORBIDDEN          (403 — authenticated but not authorized)
 *  - UnauthorizedError → UNAUTHORIZED       (401 — not authenticated)
 *  - ValidationError   → BAD_REQUEST
 *  - ConflictError     → CONFLICT
 *  - Error("Validation failed") → BAD_REQUEST (DTO decode errors)
 *  - Anything else     → INTERNAL_SERVER_ERROR  (sanitized)
 */
export function mapDomainError(err: unknown): ORPCError<string, unknown> {
	if (err instanceof NotFoundError) {
		return new ORPCError("NOT_FOUND", { message: err.message });
	}

	// ForbiddenError MUST be checked before UnauthorizedError because
	// they are separate branches of DomainError (no inheritance relation).
	if (err instanceof ForbiddenError) {
		return new ORPCError("FORBIDDEN", {
			message: "You do not have permission to perform this action",
		});
	}

	if (err instanceof UnauthorizedError) {
		return new ORPCError("UNAUTHORIZED", { message: err.message });
	}

	if (err instanceof ValidationError) {
		return new ORPCError("BAD_REQUEST", {
			message: err.message,
			data: err.details,
		});
	}

	if (err instanceof ConflictError) {
		return new ORPCError("CONFLICT", { message: err.message });
	}

	if (err instanceof DomainError) {
		return new ORPCError("BAD_REQUEST", { message: err.message });
	}

	// DTO decode errors surfaced as vanilla Error by workflows
	if (err instanceof Error && err.message === "Validation failed") {
		return new ORPCError("BAD_REQUEST", { message: err.message });
	}

	// Catch-all — never expose internal details to clients
	return new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "An unexpected error occurred",
	});
}
