import { Result, Option } from "@carbonteq/fp";
import { Document } from "./document.entity";
import { DocumentVersion } from "./document-version.entity";
import {
  DocumentNotFoundError,
  DocumentValidationError,
  DocumentDomainError,
} from "./document.errors";
import { BaseRepository, RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { DocumentId, UserId } from "@domain/utils/refined-types";
import { DocumentStatus, AccessLevel } from "./document.enums";

export interface DocumentRepository extends BaseRepository<Document> {
  fetchById(id: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  fetchByOwnerId(ownerId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>>;
  fetchBySlug(slug: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  fetchByStatus(status: DocumentStatus, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>>;
  
  existsBySlug(slug: string): Promise<RepositoryResult<boolean>>;
  
  searchByName(query: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>>;
  searchByMetadata(key: string, value: unknown, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>>;
  
  fetchWithVersions(documentId: string): Promise<RepositoryResult<Option<{ document: Document; versions: DocumentVersion[] }>, DocumentNotFoundError>>;
  
  fetchAccessibleByUser(userId: string, accessLevel: AccessLevel, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>>;
  
  archive(documentId: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  restore(documentId: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  softDelete(documentId: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  
  updateLatestVersion(documentId: string, versionId: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  
  insert(entity: Document): Promise<RepositoryResult<Option<Document>, DocumentValidationError>>;
  update(entity: Document): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  delete(id: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
}
