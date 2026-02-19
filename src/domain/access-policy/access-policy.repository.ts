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

export interface AccessPolicyRepository {
  fetchById(id: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
  
  fetchByDocumentId(documentId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<AccessPolicy>>>;
  
  fetchByUserId(userId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<AccessPolicy>>>;
  
  fetchByDocumentAndUser(documentId: string, userId: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
  
  fetchUsersWithAccessToDocument(documentId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<{ userId: string; accessLevel: AccessLevel }>>>;
  
  fetchDocumentsAccessibleByUser(userId: string, accessLevel: AccessLevel, options: PaginationOptions): Promise<RepositoryResult<Paginated<{ documentId: string; accessLevel: AccessLevel }>>>;
  
  existsByDocumentAndUser(documentId: string, userId: string): Promise<RepositoryResult<boolean>>;
  
  hasAccessLevel(documentId: string, userId: string, minAccessLevel: AccessLevel): Promise<RepositoryResult<boolean, AccessDeniedError>>;
  
  getAccessLevel(documentId: string, userId: string): Promise<RepositoryResult<Option<AccessLevel>, AccessPolicyNotFoundError>>;
  
  insert(entity: AccessPolicy): Promise<RepositoryResult<Option<AccessPolicy>, Error>>;
  
  update(entity: AccessPolicy): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
  
  delete(id: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
  deleteByDocumentAndUser(documentId: string, userId: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>>;
  deleteByDocumentId(documentId: string): Promise<RepositoryResult<number>>;
  deleteByUserId(userId: string): Promise<RepositoryResult<number>>;
}
