import { Option, Result } from "@carbonteq/fp";
import { Document } from "@domain/document/document.entity";
import type { DocumentStatus } from "@domain/document/document.enums";
import {
	DocumentNotFoundError,
	DocumentValidationError,
	DocumentVersionNotFoundError,
} from "@domain/document/document.errors";
import type { DocumentRepository } from "@domain/document/document.repository";
import { DocumentVersion } from "@domain/document/document-version.entity";
import type { RepositoryResult } from "@domain/shared/base.repository";
import type { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { documents, documentVersions } from "@infra/db/schema";
import { fetchPaginated } from "@infra/repositories/utils/pagination.util";
import { and, desc, eq } from "drizzle-orm";
import { injectable } from "tsyringe";

type DrizzleDB = any;

@injectable()
export class DocumentRepositoryImpl implements DocumentRepository {
	constructor(private db: DrizzleDB) {}

	private documentToDb(document: Document): any {
		const serialized = document.serialize();
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { versions, ...docData } = serialized;
		return {
			...docData,
			createdAt: document.createdAt.toDate(),
			updatedAt: document.updatedAt.toDate(),
		};
	}

	private versionToDb(version: DocumentVersion): any {
		return {
			...version.serialize(),
			createdAt: version.createdAt.toDate(),
			updatedAt: version.updatedAt.toDate(),
		};
	}

	private docToDomain(raw: any, versions: DocumentVersion[] = []): Document {
		return Document.fromSerialized({
			...raw,
			versions: versions.map((v) => v.serialize()),
		});
	}

	private versionToDomain(raw: any): DocumentVersion {
		return DocumentVersion.fromSerialized(raw);
	}

	async insert(
		entity: Document,
	): Promise<RepositoryResult<Option<Document>, DocumentValidationError>> {
		try {
			const docData = this.documentToDb(entity);
			const versionsData = entity.versions.map((v) => this.versionToDb(v));

			await this.db.transaction(async (tx: any) => {
				await tx.insert(documents).values(docData);
				if (versionsData.length > 0) {
					await tx
						.insert(documentVersions)
						.values(versionsData)
						.onConflictDoNothing();
				}
			});

			return Result.Ok(Option.Some(entity));
		} catch (error) {
			return Result.Err(
				new DocumentValidationError(
					`Failed to insert document aggregate: ${error}`,
				),
			);
		}
	}

	async update(
		entity: Document,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
		try {
			const docData = this.documentToDb(entity);
			const versionsData = entity.versions.map((v) => this.versionToDb(v));

			await this.db.transaction(async (tx: any) => {
				const result = await tx
					.update(documents)
					.set(docData)
					.where(eq(documents.id, entity.id.toString()))
					.returning();

				if (result.length === 0) {
					throw new DocumentNotFoundError(entity.id.toString());
				}

				if (versionsData.length > 0) {
					await tx
						.insert(documentVersions)
						.values(versionsData)
						.onConflictDoNothing();
				}
			});

			return Result.Ok(Option.Some(entity));
		} catch (_error) {
			return Result.Err(new DocumentNotFoundError(entity.id.toString()));
		}
	}

	async fetchById(
		id: string,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
		try {
			const rawDoc = await this.db.query.documents.findFirst({
				where: eq(documents.id, id),
			});

			if (!rawDoc) return Result.Ok(Option.None);

			// Fetch versions for the aggregate
			const rawVersions = await this.db.query.documentVersions.findMany({
				where: eq(documentVersions.documentId, id),
				orderBy: [desc(documentVersions.versionNumber)],
			});

			const versions = rawVersions.map((v: any) => this.versionToDomain(v));
			return Result.Ok(Option.Some(this.docToDomain(rawDoc, versions)));
		} catch (_error) {
			return Result.Err(new DocumentNotFoundError(id));
		}
	}

	async fetchBySlug(
		slug: string,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
		try {
			const rawDoc = await this.db.query.documents.findFirst({
				where: eq(documents.slug, slug),
			});

			if (!rawDoc) return Result.Ok(Option.None);

			const rawVersions = await this.db.query.documentVersions.findMany({
				where: eq(documentVersions.documentId, rawDoc.id),
				orderBy: [desc(documentVersions.versionNumber)],
			});

			const versions = rawVersions.map((v: any) => this.versionToDomain(v));
			return Result.Ok(Option.Some(this.docToDomain(rawDoc, versions)));
		} catch (_error) {
			return Result.Err(new DocumentNotFoundError(`slug: ${slug}`));
		}
	}

	async delete(
		id: string,
	): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
		try {
			const existing = await this.fetchById(id);
			if (existing.isErr()) return existing;

			const maybeDocument = existing.unwrap();
			if (maybeDocument.isNone()) {
				return Result.Err(new DocumentNotFoundError(id));
			}

			// Cascading delete should handle versions if configured in DB,
			// but we do it explicitly here if needed or just trust DB
			await this.db.delete(documents).where(eq(documents.id, id));
			return Result.Ok(maybeDocument);
		} catch (_error) {
			return Result.Err(new DocumentNotFoundError(id));
		}
	}

	async existsBy(_prop: string, _val: any): Promise<RepositoryResult<boolean>> {
		throw new Error("Method not implemented.");
	}

	async findPaginated(
		options: PaginationOptions,
		filters?: { status?: DocumentStatus; ownerId?: string },
	): Promise<RepositoryResult<Paginated<Document>>> {
		const whereClauses = [];
		if (filters?.status)
			whereClauses.push(eq(documents.status, filters.status));
		if (filters?.ownerId)
			whereClauses.push(eq(documents.ownerId, filters.ownerId));

		return fetchPaginated(
			this.db,
			documents as any,
			options,
			(raw: any) => this.docToDomain(raw), // Note: versions are not loaded for list view by default
			whereClauses.length > 0 ? and(...whereClauses) : undefined,
		);
	}

	// ─── Version management ───────────────────────────────────────────────────

	async fetchVersionById(
		id: string,
	): Promise<
		RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>
	> {
		try {
			const raw = await this.db.query.documentVersions.findFirst({
				where: eq(documentVersions.id, id),
			});
			return Result.Ok(
				Option.fromNullable(raw).map((v) => this.versionToDomain(v)),
			);
		} catch (_error) {
			return Result.Err(new DocumentVersionNotFoundError(id));
		}
	}

	async fetchVersionsByDocumentId(
		documentId: string,
		options: PaginationOptions,
	): Promise<RepositoryResult<Paginated<DocumentVersion>>> {
		return fetchPaginated(
			this.db,
			documentVersions as any,
			options,
			(raw: any) => this.versionToDomain(raw),
			eq(documentVersions.documentId, documentId),
			desc(documentVersions.versionNumber),
		);
	}

	async fetchLatestVersionByDocumentId(
		documentId: string,
	): Promise<
		RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>
	> {
		try {
			const raw = await this.db.query.documentVersions.findFirst({
				where: eq(documentVersions.documentId, documentId),
				orderBy: [desc(documentVersions.versionNumber)],
			});
			return Result.Ok(
				Option.fromNullable(raw).map((v) => this.versionToDomain(v)),
			);
		} catch (_error) {
			return Result.Err(new DocumentVersionNotFoundError(documentId));
		}
	}

	async fetchVersionByStorageKey(
		storageKey: string,
	): Promise<
		RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>
	> {
		try {
			const raw = await this.db.query.documentVersions.findFirst({
				where: eq(documentVersions.storageKey, storageKey),
			});
			return Result.Ok(
				Option.fromNullable(raw).map((v) => this.versionToDomain(v)),
			);
		} catch (_error) {
			return Result.Err(new DocumentVersionNotFoundError(storageKey));
		}
	}

	async deleteVersion(
		versionId: string,
	): Promise<
		RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>
	> {
		try {
			const existing = await this.fetchVersionById(versionId);
			if (existing.isErr()) return existing;

			const maybeVersion = existing.unwrap();
			if (maybeVersion.isNone()) {
				return Result.Ok(Option.None);
			}

			await this.db
				.delete(documentVersions)
				.where(eq(documentVersions.id, versionId));
			return Result.Ok(maybeVersion);
		} catch (_error) {
			return Result.Err(new DocumentVersionNotFoundError(versionId));
		}
	}
}
