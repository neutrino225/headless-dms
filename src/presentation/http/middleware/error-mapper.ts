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

import { WorkflowInfraError } from "@application/errors";
import {
	ConflictError,
	DomainError,
	ForbiddenError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "@domain/shared/base.errors";
import { ORPCError } from "@orpc/server";

// Well-known domain error codes that map to NOT_FOUND
const NOT_FOUND_CODES = new Set([
	"USER_NOT_FOUND",
	"DOCUMENT_NOT_FOUND",
	"DOCUMENT_VERSION_NOT_FOUND",
	"ACCESS_POLICY_NOT_FOUND",
	"NO_ACCESS_POLICY",
]);

// Well-known domain error codes that map to BAD_REQUEST
const VALIDATION_CODES = new Set([
	"USER_VALIDATION_ERROR",
	"USER_ALREADY_EXISTS",
	"EMAIL_ALREADY_TAKEN",
	"DOCUMENT_VALIDATION_ERROR",
	"ACCESS_POLICY_VALIDATION_ERROR",
	"GENERIC_DOMAIN_ERROR",
]);

// Well-known domain error codes that map to UNAUTHORIZED
const UNAUTHORIZED_CODES = new Set(["USER_UNAUTHORIZED"]);

// Well-known domain error codes that map to FORBIDDEN
const FORBIDDEN_CODES = new Set([
	"ADMIN_REQUIRED",
	"INSUFFICIENT_PERMISSIONS",
	"DOCUMENT_ACCESS_DENIED",
]);

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
 *
 * Additionally performs code-string fallback matching so that `instanceof`
 * failures caused by Bun hot-reload class identity mismatches don't
 * silently produce a 500.
 */
export function mapDomainError(err: unknown): ORPCError<string, unknown> {
	// Pass-through: already an ORPCError (e.g. thrown by auth middleware)
	if (err instanceof ORPCError) return err;

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

	// WorkflowInfraError extends DomainError but must map to 500, not 400
	if (err instanceof WorkflowInfraError) {
		return new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Service temporarily unavailable",
		});
	}

	if (err instanceof DomainError) {
		return new ORPCError("BAD_REQUEST", { message: err.message });
	}

	// ── Code-string fallback (handles instanceof failures from hot-reload) ──
	const code =
		err != null &&
		typeof err === "object" &&
		"code" in err &&
		typeof (err as Record<string, unknown>).code === "string"
			? ((err as Record<string, unknown>).code as string)
			: undefined;

	const message =
		err instanceof Error ? err.message : "An unexpected error occurred";

	if (code === "WORKFLOW_INFRA_ERROR") {
		return new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Service temporarily unavailable",
		});
	}

	if (code) {
		if (NOT_FOUND_CODES.has(code)) {
			return new ORPCError("NOT_FOUND", { message });
		}
		if (VALIDATION_CODES.has(code)) {
			return new ORPCError("BAD_REQUEST", { message });
		}
		if (UNAUTHORIZED_CODES.has(code)) {
			return new ORPCError("UNAUTHORIZED", { message });
		}
		if (FORBIDDEN_CODES.has(code)) {
			return new ORPCError("FORBIDDEN", {
				message: "You do not have permission to perform this action",
			});
		}
	}

	// DTO decode errors surfaced as vanilla Error by workflows
	if (err instanceof Error && err.message === "Validation failed") {
		return new ORPCError("BAD_REQUEST", { message: err.message });
	}

	// Domain type construction errors (e.g. "Invalid WorkspaceId: ...", "Invalid Email: ...")
	if (err instanceof Error && /^Invalid \w+:/i.test(err.message)) {
		return new ORPCError("BAD_REQUEST", { message: err.message });
	}

	// Catch-all — never expose internal details to clients
	return new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "An unexpected error occurred",
	});
}
