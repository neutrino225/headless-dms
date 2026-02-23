import { timestamp, uuid } from "drizzle-orm/pg-core";

export const UuidCol = (name: string) => uuid(name);

export const SharedColumns = {
	id: UuidCol("id").primaryKey().notNull(),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
};
