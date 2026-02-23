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
	DocumentVersionNotFoundError,
} from "./document.errors";
import type { DocumentVersion } from "./document-version.entity";

/**
 * Minimal Document repository.
 * Acts as the entry point for the Document aggregate.
 * Handles both the Document root and its versions.
 *
 * Error conventions:
 *  - fetch* methods: "not found" is Option.None; Err = infrastructure failure.
 *  - insert: Err = Error (duplicate slug, DB failure, etc.)
 *  - update/delete: Err = DocumentNotFoundError | Error
 *  - fetchVersion*: "not found" is Option.None; Err = infrastructure failure.
 *  - deleteVersion: Err = DocumentVersionNotFoundError | Error
 */
export interface DocumentRepository extends BaseRepository<Document> {
	fetchById(id: string): Promise<RepositoryResult<Option<Document>, Error>>;

	fetchBySlug(slug: string): Promise<RepositoryResult<Option<Document>, Error>>;

	insert(entity: Document): Promise<RepositoryResult<Option<Document>, Error>>;

	update(
		entity: Document,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError | Error>>;

	delete(
		id: string,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError | Error>>;

	findPaginated(
		options: PaginationOptions,
		filters?: { status?: DocumentStatus; ownerId?: string },
	): Promise<RepositoryResult<Paginated<Document>>>;

	// ─── Version management ───────────────────────────────────────────────────

	fetchVersionById(
		id: string,
	): Promise<RepositoryResult<Option<DocumentVersion>, Error>>;

	fetchVersionsByDocumentId(
		documentId: string,
		options: PaginationOptions,
	): Promise<RepositoryResult<Paginated<DocumentVersion>>>;

	fetchLatestVersionByDocumentId(
		documentId: string,
	): Promise<RepositoryResult<Option<DocumentVersion>, Error>>;

	fetchVersionByStorageKey(
		storageKey: string,
	): Promise<RepositoryResult<Option<DocumentVersion>, Error>>;

	deleteVersion(
		versionId: string,
	): Promise<
		RepositoryResult<
			Option<DocumentVersion>,
			DocumentVersionNotFoundError | Error
		>
	>;
}
