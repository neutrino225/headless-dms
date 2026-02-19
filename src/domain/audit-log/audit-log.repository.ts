import { Result, Option } from "@carbonteq/fp";
import { AuditLog } from "./audit-log.entity";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { AuditAction } from "./audit-log.enums";

export type AuditResourceType = 'document' | 'user' | 'policy';

export interface AuditLogRepository {
  fetchById(id: string): Promise<RepositoryResult<Option<AuditLog>, Error>>;
  
  fetchByUserId(userId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>>;
  
  fetchByResource(resourceId: string, resourceType: AuditResourceType, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>>;
  
  fetchByResourceType(resourceType: AuditResourceType, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>>;
  
  fetchByAction(action: AuditAction, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>>;
  
  fetchByDateRange(startDate: Date, endDate: Date, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>>;
  
  fetchByUserAndResource(userId: string, resourceId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>>;
  
  search(query: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>>;
  
  insert(entity: AuditLog): Promise<RepositoryResult<Option<AuditLog>, Error>>;
  
  countByUserId(userId: string): Promise<RepositoryResult<number>>;
  countByResource(resourceId: string, resourceType: AuditResourceType): Promise<RepositoryResult<number>>;
  countByDateRange(startDate: Date, endDate: Date): Promise<RepositoryResult<number>>;
}
