/**
 * Hono request-logging middleware.
 *
 * Generates (or extracts) a correlation ID for every inbound request,
 * attaches it to the response, and emits structured log lines for
 * request start and completion with timing metrics.
 *
 * The correlation ID is stored via `c.set("correlationId", id)` so
 * the oRPC handler can propagate it into the RPC context.
 */

import type { Logger } from "@infra/logger/logger";
import type { Context, Next } from "hono";

export function requestLoggerMiddleware(logger: Logger) {
	return async (c: Context, next: Next) => {
		const correlationId =
			c.req.header("x-correlation-id") ?? crypto.randomUUID();
		const start = performance.now();

		const reqLogger = logger.child({ correlationId });

		// Store for downstream oRPC handler
		c.set("correlationId", correlationId);
		c.set("logger", reqLogger);

		reqLogger.info("Request received", {
			method: c.req.method,
			path: c.req.path,
		});

		try {
			await next();
		} finally {
			const durationMs = Math.round(performance.now() - start);

			reqLogger.info("Request completed", {
				method: c.req.method,
				path: c.req.path,
				status: c.res.status,
				durationMs,
			});

			// Echo correlation ID in response for client-side tracing
			c.res.headers.set("x-correlation-id", correlationId);
		}
	};
}
