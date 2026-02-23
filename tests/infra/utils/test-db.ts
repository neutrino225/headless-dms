import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../../../src/infra/db/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function configureContainerRuntimeEnv() {
	const uid = process.getuid?.() ?? 1000;
	const podmanUserSocket = `/run/user/${uid}/podman/podman.sock`;
	const podmanRootSocket = "/run/podman/podman.sock";

	const currentHost = process.env.DOCKER_HOST;
	const currentSocketPath = currentHost?.replace(/^unix:\/\//, "");
	const hasValidHost = Boolean(
		currentSocketPath && existsSync(currentSocketPath),
	);

	if (!hasValidHost) {
		if (existsSync(podmanUserSocket)) {
			process.env.DOCKER_HOST = `unix://${podmanUserSocket}`;
		} else if (existsSync(podmanRootSocket)) {
			process.env.DOCKER_HOST = `unix://${podmanRootSocket}`;
		}
	}

	if (process.env.TESTCONTAINERS_RYUK_DISABLED === undefined) {
		process.env.TESTCONTAINERS_RYUK_DISABLED = "true";
	}

	if (process.env.TESTCONTAINERS_CHECKS_DISABLE === undefined) {
		process.env.TESTCONTAINERS_CHECKS_DISABLE = "true";
	}
}

export class TestDbContainer {
	private container!: StartedPostgreSqlContainer;
	private pool!: Pool;
	public db!: any;

	async start() {
		configureContainerRuntimeEnv();

		this.container = await new PostgreSqlContainer(
			"postgres:16-alpine",
		).start();

		this.pool = new Pool({
			connectionString: this.container.getConnectionUri(),
		});

		this.db = drizzle(this.pool, { schema });

		// Run migrations
		await migrate(this.db, {
			migrationsFolder: path.resolve(
				__dirname,
				"../../../src/infra/db/migrations",
			),
		});

		return { db: this.db, container: this.container };
	}

	async stop() {
		if (this.pool) await this.pool.end();
		if (this.container) await this.container.stop();
	}
}
