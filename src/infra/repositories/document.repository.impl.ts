import { Document } from "@domain/document/document.entity";
import { DocumentVersion } from "@domain/document/document-version.entity";
import { DocumentRepository } from "@domain/document/document.repository";
import {
  DocumentNotFoundError,
  DocumentValidationError,
} from "@domain/document/document.errors";
import { and, count, eq, ilike, isNotNull, sql, inArray } from "drizzle-orm";
import { documents, documentVersions } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { DocumentStatus, AccessLevel } from "@domain/document/document.enums";
import { accessPolicies } from "@infra/db/schema";

type DrizzleDB = any;

@injectable()
export class DocumentRepositoryImpl implements DocumentRepository {
  constructor(private db: DrizzleDB) {}

  private toDbSerialized(document: Document): any {
    return {
      ...document.serialize(),
      createdAt: document.createdAt.toDate(),
      updatedAt: document.updatedAt.toDate(),
    };
  }

  private toDomain(raw: any): Document {
    return Document.fromSerialized(raw);
  }

  async insert(entity: Document): Promise<RepositoryResult<Option<Document>, DocumentValidationError>> {
    try {
      const dbData = this.toDbSerialized(entity);
      await this.db.insert(documents).values(dbData);
      return Result.Ok(Option.Some(entity));
    } catch (error) {
      return Result.Err(new DocumentValidationError(`Failed to insert document: ${error}`));
    }
  }

  async update(entity: Document): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
    try {
      const dbData = this.toDbSerialized(entity);
      const result = await this.db
        .update(documents)
        .set(dbData)
        .where(eq(documents.id, entity.id.toString()))
        .returning();

      if (result.length === 0) {
        return Result.Err(new DocumentNotFoundError(entity.id.toString()));
      }
      return Result.Ok(Option.Some(entity));
    } catch (error) {
      return Result.Err(new DocumentNotFoundError(entity.id.toString()));
    }
  }

  async fetchById(id: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
    try {
      const raw = await this.db.query.documents.findFirst({
        where: eq(documents.id, id),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new DocumentNotFoundError(id));
    }
  }

  async fetchByOwnerId(ownerId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>> {
    return this.fetchPaginatedInternal(options, eq(documents.ownerId, ownerId));
  }

  async fetchBySlug(slug: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
    try {
      const raw = await this.db.query.documents.findFirst({
        where: eq(documents.slug, slug),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new DocumentNotFoundError(`slug: ${slug}`));
    }
  }

  async fetchByStatus(status: DocumentStatus, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>> {
    return this.fetchPaginatedInternal(options, eq(documents.status, status));
  }

  async existsBySlug(slug: string): Promise<RepositoryResult<boolean>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(documents)
        .where(eq(documents.slug, slug));
      return Result.Ok(Number(row.value) > 0);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async searchByName(query: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>> {
    return this.fetchPaginatedInternal(options, ilike(documents.name, `%${query}%`));
  }

  async searchByMetadata(key: string, value: unknown, options: PaginationOptions): Promise<RepositoryResult<Paginated<Document>>> {
    return this.fetchPaginatedInternal(
      options,
      sql`${documents.metadata} @> ${JSON.stringify({ [key]: value })}`
    );
  }

  async fetchWithVersions(
    documentId: string
  ): Promise<RepositoryResult<Option<{ document: Document; versions: DocumentVersion[] }>, DocumentNotFoundError>> {
    try {
      const documentRaw = await this.db.query.documents.findFirst({
        where: eq(documents.id, documentId),
      });

      if (!documentRaw) {
        return Result.Err(new DocumentNotFoundError(documentId));
      }

      const versionsRaw = await this.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, documentId))
        .orderBy(documentVersions.versionNumber);

      const document = this.toDomain(documentRaw);
      const versions = versionsRaw.map((raw: any) => DocumentVersion.fromSerialized(raw));

      return Result.Ok(Option.Some({ document, versions }));
    } catch (error) {
      return Result.Err(new DocumentNotFoundError(documentId));
    }
  }

  async fetchAccessibleByUser(
    userId: string,
    accessLevel: AccessLevel,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<Document>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const accessibleDocIds = await this.db
        .select({ documentId: accessPolicies.documentId })
        .from(accessPolicies)
        .where(
          and(
            eq(accessPolicies.userId, userId),
            eq(accessPolicies.accessLevel, accessLevel)
          )
        );

      const docIds = accessibleDocIds.map((row: any) => row.documentId);

      if (docIds.length === 0) {
        return Result.Ok({
          data: [],
          pageNum,
          pageSize,
          totalPages: 1,
        });
      }

      const [countRow] = await this.db
        .select({ total: count() })
        .from(documents)
        .where(inArray(documents.id, docIds));

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(documents)
        .where(inArray(documents.id, docIds))
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

  async archive(documentId: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
    try {
      const result = await this.db
        .update(documents)
        .set({ status: DocumentStatus.Archived, updatedAt: new Date() })
        .where(eq(documents.id, documentId))
        .returning();

      if (result.length === 0) {
        return Result.Err(new DocumentNotFoundError(documentId));
      }

      return Result.Ok(Option.Some(this.toDomain(result[0])));
    } catch (error) {
      return Result.Err(new DocumentNotFoundError(documentId));
    }
  }

  async restore(documentId: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
    try {
      const result = await this.db
        .update(documents)
        .set({ status: DocumentStatus.Active, updatedAt: new Date() })
        .where(eq(documents.id, documentId))
        .returning();

      if (result.length === 0) {
        return Result.Err(new DocumentNotFoundError(documentId));
      }

      return Result.Ok(Option.Some(this.toDomain(result[0])));
    } catch (error) {
      return Result.Err(new DocumentNotFoundError(documentId));
    }
  }

  async softDelete(documentId: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
    try {
      const result = await this.db
        .update(documents)
        .set({ status: DocumentStatus.Deleted, updatedAt: new Date() })
        .where(eq(documents.id, documentId))
        .returning();

      if (result.length === 0) {
        return Result.Err(new DocumentNotFoundError(documentId));
      }

      return Result.Ok(Option.Some(this.toDomain(result[0])));
    } catch (error) {
      return Result.Err(new DocumentNotFoundError(documentId));
    }
  }

  async updateLatestVersion(
    documentId: string,
    versionId: string
  ): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
    try {
      const result = await this.db
        .update(documents)
        .set({ latestVersionId: versionId, updatedAt: new Date() })
        .where(eq(documents.id, documentId))
        .returning();

      if (result.length === 0) {
        return Result.Err(new DocumentNotFoundError(documentId));
      }

      return Result.Ok(Option.Some(this.toDomain(result[0])));
    } catch (error) {
      return Result.Err(new DocumentNotFoundError(documentId));
    }
  }

  async delete(id: string): Promise<RepositoryResult<Option<Document>, DocumentNotFoundError>> {
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
      return Result.Err(new DocumentNotFoundError(id));
    }
  }

  private async fetchPaginatedInternal(
    options: PaginationOptions,
    whereClause?: any
  ): Promise<RepositoryResult<Paginated<Document>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(documents)
        .where(whereClause);

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(documents)
        .where(whereClause)
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

  async existsBy(prop: string, val: any): Promise<RepositoryResult<boolean>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(documents)
        .where(eq(sql.raw(prop), val));
      return Result.Ok(Number(row.value) > 0);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }
}
