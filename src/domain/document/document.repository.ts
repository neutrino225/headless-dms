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

/**
 * Minimal Document repository.
 * Complex queries, search, and access control should be handled by application services.
 */
export interface DocumentRepository extends BaseRepository<Document> {
  fetchById(id: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  
  fetchBySlug(slug: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  
  insert(entity: Document): Promise<RepositoryResult<Option<Document>, DocumentValidationError>>;
  
  update(entity: Document): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
  
  delete(id: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;
}
