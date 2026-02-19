import { pgTable, pgEnum, text, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core"
import { SharedColumns, UuidCol } from "../utils/shared-cols";
import { users } from "./user.model";
import { DocumentStatus } from "src/domain/document/document.enums";

export const documentStatusEnum = pgEnum(
  "document_status",
  Object.values(DocumentStatus) as [string, ...string[]]
);

export const documents = pgTable("documents", {
    ...SharedColumns,
    name: text("name").notNull(),
    description: text("description"),
    ownerId: UuidCol("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    mimeType: text("mimeType").notNull(),
    status: documentStatusEnum("status").notNull().default(DocumentStatus.Active),
    /**
     * Nullable FK to document_versions.id — set after the first version is uploaded.
     * Defined as a plain uuid column here (without .references()) to avoid a circular
     * import between document.model and document-version.model.
     * The FK constraint is enforced at migration level.
     */
    latestVersionId: UuidCol("latestVersionId"),
    /**
     * Flexible key-value metadata for advanced search and tagging.
     * e.g. { "department": "finance", "tags": ["Q1", "report"] }
     */
    metadata: jsonb("metadata"),
}, (t) => [
    index("idx_documents_owner_id").on(t.ownerId),
    uniqueIndex("uq_documents_slug").on(t.slug),
])