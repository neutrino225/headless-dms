/**
 * Application entrypoint.
 *
 * Loads configuration, bootstraps the DI container, builds the oRPC router,
 * and starts a Hono server on the configured port.
 */

import "reflect-metadata";

import { loadConfig } from "@infra/config/env";
import { db } from "@infra/db/db";
import { bootstrapContainer } from "@infra/di/container/bootstrap";
import { createLogger } from "@infra/logger/logger";
import { createApp } from "@presentation/http/app";
import { createRouter } from "@presentation/http/routes/router";

const config = loadConfig();

// ── Structured logger ─────────────────────────────────────────────────────
const logger = createLogger({ service: "headless-dms" });

// Bootstrap DI — resolve all workflows with real repository implementations
const workflows = bootstrapContainer(db, config);

// Build the oRPC router
const router = createRouter({
	jwtSecret: config.jwtSecret,
	logger,
	...workflows,
});

// Create Hono app with oRPC handler
const app = createApp({
	router,
	corsOrigin: config.corsOrigin,
	logger,
});

// Start the server (Bun native)
const server = Bun.serve({
	fetch: app.fetch,
	port: config.port,
});

logger.info("Server started", {
	port: server.port,
	url: `http://localhost:${server.port}/rpc`,
});
