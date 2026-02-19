import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../../db/schema";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TestDbContainer {
  private container!: StartedPostgreSqlContainer;
  private pool!: Pool;
  public db!: any;

  async start() {
    this.container = await new PostgreSqlContainer("postgres:16-alpine").start();

    this.pool = new Pool({
      connectionString: this.container.getConnectionUri(),
    });

    this.db = drizzle(this.pool, { schema });

    // Run migrations
    await migrate(this.db, {
      migrationsFolder: path.resolve(__dirname, "../../db/migrations"),
    });

    return { db: this.db, container: this.container };
  }

  async stop() {
    if (this.pool) await this.pool.end();
    if (this.container) await this.container.stop();
  }
}
