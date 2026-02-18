import { pgTable, pgEnum, varchar, uniqueIndex } from "drizzle-orm/pg-core"
import { SharedColumns } from "../utils/shared-cols"
import { UserRole } from "@domain/user/user.enums"

export const userRoleEnum = pgEnum("user_role", Object.values(UserRole) as [string, ...string[]]);

export const users = pgTable("users", {
    ...SharedColumns,
    email: varchar("email", { length: 320 }).notNull(),
    role: userRoleEnum("role").notNull(),
}, (t) => [
    uniqueIndex("uq_users_email").on(t.email),
])