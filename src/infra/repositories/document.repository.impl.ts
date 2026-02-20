import { Document } from "@domain/document/document.entity";
import { DocumentRepository } from "@domain/document/document.repository";
import { DocumentNotFoundError, DocumentValidationError } from "@domain/document/document.errors";
import { and, eq } from "drizzle-orm";
import { documents } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { fetchPaginated } from "@infra/repositories/utils/pagination.util";
import { DocumentStatus } from "@domain/document/document.enums";

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

  async existsBy(prop: string, val: any): Promise<RepositoryResult<boolean>> {
    throw new Error("Method not implemented.");
  }

  async findPaginated(
    options: PaginationOptions,
    filters?: { status?: DocumentStatus; ownerId?: string },
  ): Promise<RepositoryResult<Paginated<Document>>> {
    const whereClauses = [];
    if (filters?.status) whereClauses.push(eq(documents.status, filters.status));
    if (filters?.ownerId)
      whereClauses.push(eq(documents.ownerId, filters.ownerId));

    return fetchPaginated(
      this.db,
      documents as any,
      options,
      this.toDomain,
      whereClauses.length > 0 ? and(...whereClauses) : undefined,
    );
  }
}
