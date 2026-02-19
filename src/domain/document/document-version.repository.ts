import { Result, Option } from "@carbonteq/fp";
import { DocumentVersion } from "./document-version.entity";
import {
  DocumentVersionNotFoundError,
  DocumentValidationError,
} from "./document.errors";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { DocumentId, DocumentVersionId } from "@domain/utils/refined-types";

export interface DocumentVersionRepository {
  fetchById(id: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>>;
  
  fetchByDocumentId(documentId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<DocumentVersion>>>;
  
  fetchByVersionNumber(documentId: string, versionNumber: number): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>>;
  
  fetchLatestByDocumentId(documentId: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>>;
  
  fetchByStorageKey(storageKey: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>>;
  
  fetchByChecksum(checksum: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<DocumentVersion>>>;
  
  existsByStorageKey(storageKey: string): Promise<RepositoryResult<boolean>>;
  
  existsByChecksum(checksum: string): Promise<RepositoryResult<boolean>>;
  
  getNextVersionNumber(documentId: string): Promise<RepositoryResult<number, DocumentVersionNotFoundError>>;
  
  countByDocumentId(documentId: string): Promise<RepositoryResult<number>>;
  
  insert(entity: DocumentVersion): Promise<RepositoryResult<Option<DocumentVersion>, DocumentValidationError>>;
  
  delete(id: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>>;
  deleteByDocumentId(documentId: string): Promise<RepositoryResult<number>>;
}
