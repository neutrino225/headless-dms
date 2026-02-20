import { DocumentVersion } from "@domain/document/document-version.entity";
import { DocumentVersionRepository } from "@domain/document/document-version.repository";
import {
  DocumentVersionNotFoundError,
  DocumentValidationError,
} from "@domain/document/document.errors";
import { and, count, desc, eq, sql } from "drizzle-orm";
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
    return this.fetchPaginatedInternal(
      options,
      eq(documentVersions.documentId, documentId),
      desc(documentVersions.versionNumber)
    );
  }

  private async fetchPaginatedInternal(
    options: PaginationOptions,
    whereClause?: any,
    orderBy?: any
  ): Promise<RepositoryResult<Paginated<DocumentVersion>>> {
    return fetchPaginated(
      this.db,
      documentVersions,
      options,
      this.toDomain,
      whereClause,
      orderBy
    );
  }

  async fetchByVersionNumber(
    documentId: string,
    versionNumber: number
  ): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>> {
    try {
      const raw = await this.db.query.documentVersions.findFirst({
        where: and(
          eq(documentVersions.documentId, documentId),
          eq(documentVersions.versionNumber, versionNumber)
        ),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new DocumentVersionNotFoundError(`${documentId}#${versionNumber}`));
    }
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

  async fetchByStorageKey(
    storageKey: string
  ): Promise<RepositoryResult<Option<DocumentVersion>, DocumentVersionNotFoundError>> {
    try {
      const raw = await this.db.query.documentVersions.findFirst({
        where: eq(documentVersions.storageKey, storageKey),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new DocumentVersionNotFoundError(`storageKey: ${storageKey}`));
    }
  }

  async fetchByChecksum(checksum: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<DocumentVersion>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(documentVersions)
        .where(eq(documentVersions.checksum, checksum));

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.checksum, checksum))
        .limit(pageSize)
        .offset(offset - pageSize);

      const items = rawRows.map(this.toDomain);

      return Result.Ok({
        data: items,
        pageNum,
        pageSize,
        totalPages,
      });
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async existsByStorageKey(storageKey: string): Promise<RepositoryResult<boolean>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(documentVersions)
        .where(eq(documentVersions.storageKey, storageKey));
      return Result.Ok(Number(row.value) > 0);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async existsByChecksum(checksum: string): Promise<RepositoryResult<boolean>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(documentVersions)
        .where(eq(documentVersions.checksum, checksum));
      return Result.Ok(Number(row.value) > 0);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async getNextVersionNumber(documentId: string): Promise<RepositoryResult<number, DocumentVersionNotFoundError>> {
    try {
      const [row] = await this.db
        .select({ maxVersion: sql<number>`COALESCE(MAX(${documentVersions.versionNumber}), 0)` })
        .from(documentVersions)
        .where(eq(documentVersions.documentId, documentId));

      return Result.Ok(Number(row.maxVersion) + 1);
    } catch (error) {
      return Result.Err(new DocumentVersionNotFoundError(documentId));
    }
  }

  async countByDocumentId(documentId: string): Promise<RepositoryResult<number>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(documentVersions)
        .where(eq(documentVersions.documentId, documentId));
      return Result.Ok(Number(row.value));
    } catch (error) {
      return Result.Err(error as Error);
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

  async deleteByDocumentId(documentId: string): Promise<RepositoryResult<number>> {
    try {
      const result = await this.db
        .delete(documentVersions)
        .where(eq(documentVersions.documentId, documentId))
        .returning({ id: documentVersions.id });

      return Result.Ok(result.length);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }
}
