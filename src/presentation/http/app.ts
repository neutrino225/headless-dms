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
import { onError } from "@orpc/server";
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
				logger.error("oRPC handler error", {
					errorMessage: error instanceof Error ? error.message : String(error),
				});
			}),
		],
	});

	// Health check — not behind oRPC
	app.get("/health", (c) => c.json({ status: "ok" }));

	// oRPC handler — all RPC traffic goes through /rpc/*
	app.use("/rpc/*", async (c, next) => {
		const correlationId =
			(c.get("correlationId") as string | undefined) ?? crypto.randomUUID();

		const { matched, response } = await handler.handle(c.req.raw, {
			prefix: "/rpc",
			context: {
				headers: c.req.raw.headers,
				correlationId,
			},
		});

		if (matched) {
			return c.newResponse(response.body, response);
		}

		await next();
	});

	return app;
}
