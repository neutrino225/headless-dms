/**
 * Hono application factory.
 *
 * Creates a Hono app wired to the oRPC RPCHandler with CORS support.
 * Includes request-level structured logging with correlation ID tracking
 * and performance timing.
 *
 * Separated from the entrypoint so it can be tested independently.
 */

import type { Logger } from "@infra/logger/logger";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { Hono } from "hono";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";
import type { AppRouter } from "./routes/router";

export interface CreateAppOptions {
	router: AppRouter;
	corsOrigin: string;
	logger: Logger;
}

export function createApp({ router, corsOrigin, logger }: CreateAppOptions) {
	const app = new Hono<{
		Variables: {
			correlationId: string;
			logger: Logger;
		};
	}>();

	// ── Request logging & correlation ID ──────────────────────────────────
	app.use("*", requestLoggerMiddleware(logger));

	const handler = new RPCHandler(router, {
		plugins: [
			new CORSPlugin({
				origin: corsOrigin,
				allowMethods: ["GET", "POST", "OPTIONS"],
			}),
		],
		interceptors: [
			onError((error) => {
				const isValidationError =
					error instanceof ORPCError &&
					(error.code === "BAD_REQUEST" ||
						error.message.includes("validation"));

				logger.error(
					isValidationError ? "Validation error" : "oRPC handler error",
					{
						errorMessage:
							error instanceof Error ? error.message : String(error),
						data: error instanceof ORPCError ? error.data : undefined,
					},
				);
			}),
		],
	});

	// Health check — not behind oRPC
	app.get("/health", (c) => c.json({ status: "ok" }));

	// oRPC handler — all RPC traffic goes through /rpc/*
	app.all("/rpc/*", async (c) => {
		const correlationId =
			(c.get("correlationId") as string | undefined) ?? crypto.randomUUID();

		// We clone the request to avoid locking the stream for oRPC
		const req = c.req.raw.clone();

		const { matched, response } = await handler.handle(req, {
			prefix: "/rpc",
			context: {
				headers: req.headers,
				correlationId,
			},
		});

		if (matched) {
			const res = c.newResponse(response.body, response);
			res.headers.set("x-correlation-id", correlationId);
			return res;
		}

		return c.notFound();
	});

	return app;
}
