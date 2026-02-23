/**
 * Caller context — represents the authenticated user making a request.
 *
 * Extracted from the JWT token in the HTTP auth middleware and passed
 * to use-case (workflow) methods.
 */
export interface CallerContext {
	/** Authenticated user ID (from JWT `sub` claim). */
	readonly userId: string;
	/** User role string (e.g. "ADMIN" | "USER", from JWT `role` claim). */
	readonly role: string;
	/** Workspace ID from JWT claim, used for tenant-aware authorization/context. */
	readonly workspaceId: string;
}
