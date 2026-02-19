import { pgTable, pgEnum, jsonb, index } from "drizzle-orm/pg-core"
import { SharedColumns, UuidCol } from "../utils/shared-cols";
import { users } from "./user.model";
import { AuditAction } from "src/domain/audit-log/audit-log.enums";

export const auditActionEnum = pgEnum("audit_action", Object.values(AuditAction) as [string, ...string[]]);

export const auditResourceTypeEnum = pgEnum("audit_resource_type", ["document", "user", "policy"]);

/**
 * Audit logs are append-only — updatedAt (from SharedColumns) will always equal createdAt.
 */
export const auditLogs = pgTable("audit_logs", {
    ...SharedColumns,
    userId: UuidCol("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    action: auditActionEnum("action").notNull(),
    resourceId: UuidCol("resourceId").notNull(),
    resourceType: auditResourceTypeEnum("resourceType").notNull(),
    /** Optional structured payload for the action. */
    metadata: jsonb("metadata"),
}, (t) => [
    index("idx_audit_logs_user_id").on(t.userId),
    index("idx_audit_logs_resource_id").on(t.resourceId),
])
