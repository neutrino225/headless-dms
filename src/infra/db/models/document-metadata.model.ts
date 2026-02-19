import { pgTable, text, unique } from "drizzle-orm/pg-core"
import { SharedColumns, UuidCol } from "../utils/shared-cols";
import { documents } from "./document.model";

export const documentMetadata = pgTable("document_metadata", {
    ...SharedColumns,
    documentId: UuidCol("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
}, (t) => [
    unique("uq_doc_metadata_key").on(t.documentId, t.key),
])