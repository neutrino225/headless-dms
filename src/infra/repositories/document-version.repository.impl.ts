import { DocumentVersion } from "@domain/document/document-version.entity";
import { DocumentVersionRepository } from "@domain/document/document-version.repository";
import {
  DocumentVersionNotFoundError,
  DocumentValidationError,
} from "@domain/document/document.errors";
import { desc, eq } from "drizzle-orm";
import { documentVersions } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { fetchPaginated } from "@infra/repositories/utils/pagination.util";

type DrizzleDB = any;

@injectable()
export class DocumentVersionRepositoryImpl implements DocumentVersionRepository {
  constructor(private db: DrizzleDB) {}

  private toDbSerialized(version: DocumentVersion): any {
    return {
      ...version.serialize(),
      createdAt: version.createdAt.toDate(),
      updatedAt: version.updatedAt.toDate(),
    };
  }

  private toDomain(raw: any): DocumentVersion {
    return DocumentVersion.fromSerialized(raw);
  }

  async insert(entity: DocumentVersion): Promise<RepositoryResult<Option<DocumentVersion>, DocumentValidationError>> {
    try {
      const dbData = this.toDbSerialized(entity);
      await this.db.insert(documentVersions).values(dbData);
      return Result.Ok(Option.Some(entity));
    } catch (error) {
      return Result.Err(new DocumentValidationError(`Failed to insert document version: ${error}`));
    }
  }

  async fetchById(id: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>> {
    try {
      const raw = await this.db.query.documentVersions.findFirst({
        where: eq(documentVersions.id, id),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new DocumentVersionNotFoundError(id));
    }
  }

  async fetchByDocumentId(
    documentId: string,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<DocumentVersion>>> {
    return fetchPaginated(
      this.db,
      documentVersions,
      options,
      this.toDomain,
      eq(documentVersions.documentId, documentId),
      desc(documentVersions.versionNumber)
    );
  }

  async fetchLatestByDocumentId(
    documentId: string
  ): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>> {
    try {
      const raw = await this.db.query.documentVersions.findFirst({
        where: eq(documentVersions.documentId, documentId),
        orderBy: [desc(documentVersions.versionNumber)],
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new DocumentVersionNotFoundError(documentId));
    }
  }

  async fetchByStorageKey(storageKey: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>> {
    try {
      const raw = await this.db.query.documentVersions.findFirst({
        where: eq(documentVersions.storageKey, storageKey),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new DocumentVersionNotFoundError(storageKey));
    }
  }

  async delete(id: string): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>> {
    try {
      const existing = await this.fetchById(id);
      if (existing.isErr()) return existing;

      const maybeVersion = existing.unwrap();
      if (maybeVersion.isNone()) {
        return Result.Err(new DocumentVersionNotFoundError(id));
      }

      await this.db.delete(documentVersions).where(eq(documentVersions.id, id));
      return Result.Ok(maybeVersion);
    } catch (error) {
      return Result.Err(new DocumentVersionNotFoundError(id));
    }
  }
}
