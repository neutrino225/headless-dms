import { pgTable, pgEnum, varchar, boolean, uniqueIndex } from "drizzle-orm/pg-core"
import { SharedColumns } from "./shared-cols"
import { UserRole } from "src/domain/user/user.enums"

export const userRoleEnum = pgEnum("user_role", Object.values(UserRole) as [string, ...string[]]);

export const users = pgTable("users", {
    ...SharedColumns,
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    displayName: varchar("displayName", { length: 150 }),
    isActive: boolean("isActive").notNull().default(true),
}, (t) => [
    uniqueIndex("uq_users_email").on(t.email),
])