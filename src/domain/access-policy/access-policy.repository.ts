import { Result, Option } from "@carbonteq/fp";
import { AccessPolicy } from "@domain/access-policy/access-policy.entity";
import {
  AccessPolicyNotFoundError,
  AccessDeniedError,
} from "@domain/access-policy/access-policy.errors";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { DocumentId, UserId, AccessPolicyId } from "@domain/utils/refined-types";
import { AccessLevel } from "@domain/document/document.enums";

/**
 * Minimal AccessPolicy repository.
 * Complex queries should be handled by application services.
 */
export interface AccessPolicyRepository {
  fetchById(id: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
  
  fetchByDocumentAndUser(documentId: string, userId: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
  
  insert(entity: AccessPolicy): Promise<RepositoryResult<Option<AccessPolicy>, Error>>;
  
  update(entity: AccessPolicy): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
  
  delete(id: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
}
