import {
	boolean,
	pgEnum,
	pgTable,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { UserRole } from "src/domain/user/user.enums";
import { SharedColumns, UuidCol } from "./shared-cols";

export const userRoleEnum = pgEnum(
	"user_role",
	Object.values(UserRole) as [string, ...string[]],
);

export const users = pgTable(
	"users",
	{
		...SharedColumns,
		workspaceId: UuidCol("workspaceId").notNull(),
		email: varchar("email", { length: 320 }).notNull(),
		passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
		role: userRoleEnum("role").notNull(),
		displayName: varchar("displayName", { length: 150 }),
		isActive: boolean("isActive").notNull().default(true),
	},
	(t) => [uniqueIndex("uq_users_email").on(t.email)],
);
