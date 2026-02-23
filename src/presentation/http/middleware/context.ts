/**
 * oRPC context types.
 *
 * - InitialContext: provided at the Hono adapter level (raw headers + correlation ID).
 * - AuthContext:    added by the auth middleware (verified user claims).
 */

export interface JwtPayload {
	readonly sub: string; // user ID
	readonly email: string;
	readonly role: string;
	readonly workspaceId: string;
}

/** Passed into every procedure from the Hono handler. */
export interface InitialContext {
	readonly headers: Headers;
	/** Unique ID for request correlation across logs and services. */
	readonly correlationId: string;
}

/** Available after the auth middleware runs. */
export interface AuthContext extends InitialContext {
	readonly user: JwtPayload;
}
