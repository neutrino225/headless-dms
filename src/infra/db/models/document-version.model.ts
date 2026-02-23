import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	index,
	integer,
	pgTable,
	text,
	unique,
} from "drizzle-orm/pg-core";
import { documents } from "./document.model";
import { SharedColumns, UuidCol } from "./shared-cols";
import { users } from "./user.model";

export const documentVersions = pgTable(
	"document_versions",
	{
		...SharedColumns,
		documentId: UuidCol("documentId")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		versionNumber: integer("versionNumber").notNull(),
		storageKey: text("storageKey").notNull(),
		mimeType: text("mimeType").notNull(),
		sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
		checksum: text("checksum").notNull(),
		uploadedBy: UuidCol("uploadedBy")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
	},
	(t) => [
		check("chk_version_positive", sql`${t.versionNumber} >= 1`),
		unique("uq_doc_version").on(t.documentId, t.versionNumber),
		index("idx_doc_versions_document_id").on(t.documentId),
	],
);
