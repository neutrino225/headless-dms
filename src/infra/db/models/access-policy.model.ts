import { index, pgEnum, pgTable, unique } from "drizzle-orm/pg-core";
import { AccessLevel } from "src/domain/document/document.enums";
import { documents } from "./document.model";
import { SharedColumns, UuidCol } from "./shared-cols";
import { users } from "./user.model";

export const accessLevelEnum = pgEnum(
	"accessLevel",
	Object.values(AccessLevel) as [string, ...string[]],
);

export const accessPolicies = pgTable(
	"access_policies",
	{
		...SharedColumns,
		documentId: UuidCol("documentId")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		userId: UuidCol("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessLevel: accessLevelEnum("accessLevel").notNull(),
	},
	(t) => [
		unique("uq_access_policy").on(t.documentId, t.userId),
		index("idx_access_policies_user_id").on(t.userId),
		index("idx_access_policies_document_id").on(t.documentId),
	],
);
