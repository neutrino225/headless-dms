import { Result, Option } from "@carbonteq/fp";
import { AuditLog } from "./audit-log.entity";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { AuditAction } from "./audit-log.enums";

export type AuditResourceType = 'document' | 'user' | 'policy';

/**
 * Minimal AuditLog repository.
 * Audit logs are append-only. Complex queries should use dedicated query services.
 */
export interface AuditLogRepository {
  fetchById(id: string): Promise<RepositoryResult<Option<AuditLog>, Error>>;
  
  insert(entity: AuditLog): Promise<RepositoryResult<Option<AuditLog>, Error>>;
}
