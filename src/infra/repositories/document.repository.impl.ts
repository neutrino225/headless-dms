import { Option, Result } from "@carbonteq/fp";
import { Document } from "@domain/document/document.entity";
import type { DocumentStatus } from "@domain/document/document.enums";
import {
	DocumentNotFoundError,
	DocumentVersionNotFoundError,
} from "@domain/document/document.errors";
import type { DocumentRepository } from "@domain/document/document.repository";
import { DocumentVersion } from "@domain/document/document-version.entity";
import type { RepositoryResult } from "@domain/shared/base.repository";
import type { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { DbOperationError } from "@infra/errors";
import { documents, documentVersions } from "@infra/db/schema";
import { fetchPaginated } from "@infra/repositories/utils/pagination.util";
import { and, desc, eq } from "drizzle-orm";
import { injectable } from "tsyringe";

// PostgreSQL unique-constraint violation code
const PG_UNIQUE_VIOLATION = "23505";

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
	): Promise<RepositoryResult<Option<Document>, Error>> {
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
			// 23505 = unique slug constraint or other unique violation
			if ((error as any)?.code === PG_UNIQUE_VIOLATION) {
				return Result.Err(
					new DbOperationError(
						`document.insert (duplicate slug or id: ${entity.slug})`,
						error,
					),
				);
			}
			return Result.Err(new DbOperationError("document.insert", error));
		}
	}

	async update(
		entity: Document,
	): Promise<
		RepositoryResult<Option<Document>, DocumentNotFoundError | Error>
	> {
		try {
			const docData = this.documentToDb(entity);
			const versionsData = entity.versions.map((v) => this.versionToDb(v));
			let notFound = false;

			await this.db.transaction(async (tx: any) => {
				const result = await tx
					.update(documents)
					.set(docData)
					.where(eq(documents.id, entity.id.toString()))
					.returning();

				if (result.length === 0) {
					notFound = true;
					return;
				}

				if (versionsData.length > 0) {
					await tx
						.insert(documentVersions)
						.values(versionsData)
						.onConflictDoNothing();
				}
			});

			if (notFound) {
				return Result.Err(new DocumentNotFoundError(entity.id.toString()));
			}
			return Result.Ok(Option.Some(entity));
		} catch (error) {
			return Result.Err(new DbOperationError("document.update", error));
		}
	}

	async fetchById(
		id: string,
	): Promise<RepositoryResult<Option<Document>, Error>> {
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
		} catch (error) {
			return Result.Err(new DbOperationError("document.fetchById", error));
		}
	}

	async fetchBySlug(
		slug: string,
	): Promise<RepositoryResult<Option<Document>, Error>> {
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
		} catch (error) {
			return Result.Err(new DbOperationError("document.fetchBySlug", error));
		}
	}

	async delete(
		id: string,
	): Promise<
		RepositoryResult<Option<Document>, DocumentNotFoundError | Error>
	> {
		try {
			const existing = await this.fetchById(id);
			if (existing.isErr()) return existing;

			const maybeDocument = existing.unwrap();
			if (maybeDocument.isNone()) {
				return Result.Err(new DocumentNotFoundError(id));
			}

			await this.db.delete(documents).where(eq(documents.id, id));
			return Result.Ok(maybeDocument);
		} catch (error) {
			return Result.Err(new DbOperationError("document.delete", error));
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
	): Promise<RepositoryResult<Option<DocumentVersion>, Error>> {
		try {
			const raw = await this.db.query.documentVersions.findFirst({
				where: eq(documentVersions.id, id),
			});
			return Result.Ok(
				Option.fromNullable(raw).map((v) => this.versionToDomain(v)),
			);
		} catch (error) {
			return Result.Err(
				new DbOperationError("document.fetchVersionById", error),
			);
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
	): Promise<RepositoryResult<Option<DocumentVersion>, Error>> {
		try {
			const raw = await this.db.query.documentVersions.findFirst({
				where: eq(documentVersions.documentId, documentId),
				orderBy: [desc(documentVersions.versionNumber)],
			});
			return Result.Ok(
				Option.fromNullable(raw).map((v) => this.versionToDomain(v)),
			);
		} catch (error) {
			return Result.Err(
				new DbOperationError("document.fetchLatestVersion", error),
			);
		}
	}

	async fetchVersionByStorageKey(
		storageKey: string,
	): Promise<RepositoryResult<Option<DocumentVersion>, Error>> {
		try {
			const raw = await this.db.query.documentVersions.findFirst({
				where: eq(documentVersions.storageKey, storageKey),
			});
			return Result.Ok(
				Option.fromNullable(raw).map((v) => this.versionToDomain(v)),
			);
		} catch (error) {
			return Result.Err(
				new DbOperationError("document.fetchVersionByStorageKey", error),
			);
		}
	}

	async deleteVersion(
		versionId: string,
	): Promise<
		RepositoryResult<
			Option<DocumentVersion>,
			DocumentVersionNotFoundError | Error
		>
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
		} catch (error) {
			return Result.Err(new DbOperationError("document.deleteVersion", error));
		}
	}
}
