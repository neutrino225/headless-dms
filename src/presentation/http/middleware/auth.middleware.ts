/**
 * oRPC auth middleware.
 *
 * Extracts and verifies a JWT from the `Authorization: Bearer <token>` header.
 * On success, injects `{ user: JwtPayload }` into the execution context.
 * On failure, throws ORPCError("UNAUTHORIZED").
 *
 * Also propagates the correlation ID from the initial context.
 */

import { ORPCError, os } from "@orpc/server";
import jwt from "jsonwebtoken";
import type { Logger } from "@infra/logger/logger";
import type { InitialContext, JwtPayload } from "./context";

function isValidJwtPayload(value: unknown): value is JwtPayload {
	if (!value || typeof value !== "object") return false;
	const payload = value as Record<string, unknown>;
	return (
		typeof payload.sub === "string" &&
		typeof payload.email === "string" &&
		typeof payload.role === "string" &&
		typeof payload.workspaceId === "string"
	);
}

/**
 * Build the auth middleware.
 * Accepts the JWT secret and an optional logger at setup time.
 */
export function createAuthMiddleware(jwtSecret: string, logger?: Logger) {
	return os.$context<InitialContext>().middleware(async ({ context, next }) => {
		const correlationId = context.correlationId;
		const reqLogger = logger?.child({ correlationId });

		const authHeader = context.headers.get("authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			reqLogger?.warn("Auth failed: missing or malformed Authorization header");
			throw new ORPCError("UNAUTHORIZED", {
				message: "Missing or malformed Authorization header",
			});
		}

		const token = authHeader.slice(7);

		try {
			const decoded = jwt.verify(token, jwtSecret);

			if (!isValidJwtPayload(decoded)) {
				reqLogger?.warn("Auth failed: JWT payload is missing required claims");
				throw new ORPCError("UNAUTHORIZED", {
					message: "Invalid or expired token",
				});
			}

			reqLogger?.debug("Auth succeeded", {
				userId: decoded.sub,
				role: decoded.role,
				workspaceId: decoded.workspaceId,
			});

			return next({
				context: { user: decoded },
			});
		} catch {
			reqLogger?.warn("Auth failed: invalid or expired token");
			throw new ORPCError("UNAUTHORIZED", {
				message: "Invalid or expired token",
			});
		}
	});
}
