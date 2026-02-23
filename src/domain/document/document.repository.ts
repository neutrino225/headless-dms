import type { Option } from "@carbonteq/fp";
import type {
	BaseRepository,
	RepositoryResult,
} from "@domain/shared/base.repository";
import type { Paginated, PaginationOptions } from "@domain/shared/pagination";
import type { Document } from "./document.entity";
import type { DocumentStatus } from "./document.enums";
import type {
	DocumentNotFoundError,
	DocumentValidationError,
	DocumentVersionNotFoundError,
} from "./document.errors";
import type { DocumentVersion } from "./document-version.entity";

/**
 * Minimal Document repository.
 * Acts as the entry point for the Document aggregate.
 * Handles both the Document root and its versions.
 */
export interface DocumentRepository extends BaseRepository<Document> {
	fetchById(
		id: string,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;

	fetchBySlug(
		slug: string,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;

	insert(
		entity: Document,
	): Promise<RepositoryResult<Option<Document>, DocumentValidationError>>;

	update(
		entity: Document,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;

	delete(
		id: string,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>>;

	findPaginated(
		options: PaginationOptions,
		filters?: { status?: DocumentStatus; ownerId?: string },
	): Promise<RepositoryResult<Paginated<Document>>>;

	// ─── Version management ───────────────────────────────────────────────────

	fetchVersionById(
		id: string,
	): Promise<
		RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>
	>;

	fetchVersionsByDocumentId(
		documentId: string,
		options: PaginationOptions,
	): Promise<RepositoryResult<Paginated<DocumentVersion>>>;

	fetchLatestVersionByDocumentId(
		documentId: string,
	): Promise<
		RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>
	>;

	fetchVersionByStorageKey(
		storageKey: string,
	): Promise<
		RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>
	>;

	deleteVersion(
		versionId: string,
	): Promise<
		RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>
	>;
}
