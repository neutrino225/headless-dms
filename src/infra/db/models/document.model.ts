import { pgTable, text, boolean, index } from "drizzle-orm/pg-core"
import { SharedColumns, UuidCol } from "../utils/shared-cols";
import { users } from "./user.model";

export const documents = pgTable("documents", {
    ...SharedColumns,
    name: text("name").notNull(),
    description: text("description"),
    isArchived: boolean("isArchived").notNull().default(false),
    ownerId: UuidCol("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [
    index("idx_documents_owner_id").on(t.ownerId),
])