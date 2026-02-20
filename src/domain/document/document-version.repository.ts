import { Result, Option } from "@carbonteq/fp";
import { DocumentVersion } from "./document-version.entity";
import {
  DocumentVersionNotFoundError,
  DocumentValidationError,
} from "./document.errors";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { DocumentId, DocumentVersionId } from "@domain/utils/refined-types";

/**
 * Minimal DocumentVersion repository.
 * Complex queries should be handled by application services.
 */
export interface DocumentVersionRepository {
  fetchById(id: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>>;
  
  fetchByDocumentId(documentId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<DocumentVersion>>>;
  
  fetchLatestByDocumentId(documentId: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>>;
  
  insert(entity: DocumentVersion): Promise<RepositoryResult<Option<DocumentVersion>, DocumentValidationError>>;
  
  delete(id: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>>;
}
