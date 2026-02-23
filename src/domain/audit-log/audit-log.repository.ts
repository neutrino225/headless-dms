import type { Option } from "@carbonteq/fp";
import type { RepositoryResult } from "@domain/shared/base.repository";
import type { AuditLog } from "./audit-log.entity";

export type AuditResourceType = "document" | "user" | "policy";

/**
 * Minimal AuditLog repository.
 * Audit logs are append-only. Complex queries should use dedicated query services.
 */
export interface AuditLogRepository {
	fetchById(id: string): Promise<RepositoryResult<Option<AuditLog>, Error>>;

	insert(entity: AuditLog): Promise<RepositoryResult<Option<AuditLog>, Error>>;
}
