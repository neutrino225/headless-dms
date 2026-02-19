import { AccessPolicy } from "@domain/access-policy/access-policy.entity";
import { AccessPolicyRepository } from "@domain/access-policy/access-policy.repository";
import {
  AccessPolicyNotFoundError,
  AccessDeniedError,
} from "@domain/access-policy/access-policy.errors";
import { AccessLevel } from "@domain/document/document.enums";
import { and, count, eq } from "drizzle-orm";
import { accessPolicies } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";

type DrizzleDB = any;

@injectable()
export class AccessPolicyRepositoryImpl implements AccessPolicyRepository {
  constructor(private db: DrizzleDB) {}

  private toDbSerialized(policy: AccessPolicy): any {
    return {
      ...policy.serialize(),
      createdAt: policy.createdAt.toDate(),
      updatedAt: policy.updatedAt.toDate(),
    };
  }

  private toDomain(raw: any): AccessPolicy {
    return AccessPolicy.fromSerialized(raw);
  }

  async insert(entity: AccessPolicy): Promise<RepositoryResult<Option<AccessPolicy>, Error>> {
    try {
      const dbData = this.toDbSerialized(entity);
      await this.db.insert(accessPolicies).values(dbData);
      return Result.Ok(Option.Some(entity));
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async update(entity: AccessPolicy): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>> {
    try {
      const dbData = this.toDbSerialized(entity);
      const result = await this.db
        .update(accessPolicies)
        .set(dbData)
        .where(eq(accessPolicies.id, entity.id.toString()))
        .returning();

      if (result.length === 0) {
        return Result.Err(new AccessPolicyNotFoundError(entity.documentId.toString(), entity.userId.toString()));
      }
      return Result.Ok(Option.Some(entity));
    } catch (error) {
      return Result.Err(new AccessPolicyNotFoundError(entity.documentId.toString(), entity.userId.toString()));
    }
  }

  async fetchById(id: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>> {
    try {
      const raw = await this.db.query.accessPolicies.findFirst({
        where: eq(accessPolicies.id, id),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new AccessPolicyNotFoundError(id, id));
    }
  }

  async fetchByDocumentId(
    documentId: string,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<AccessPolicy>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(accessPolicies)
        .where(eq(accessPolicies.documentId, documentId));

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(accessPolicies)
        .where(eq(accessPolicies.documentId, documentId))
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

  async fetchByUserId(userId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<AccessPolicy>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(accessPolicies)
        .where(eq(accessPolicies.userId, userId));

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(accessPolicies)
        .where(eq(accessPolicies.userId, userId))
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

  async fetchByDocumentAndUser(
    documentId: string,
    userId: string
  ): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>> {
    try {
      const raw = await this.db.query.accessPolicies.findFirst({
        where: and(
          eq(accessPolicies.documentId, documentId),
          eq(accessPolicies.userId, userId)
        ),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(new AccessPolicyNotFoundError(documentId, userId));
    }
  }

  async fetchUsersWithAccessToDocument(
    documentId: string,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<{ userId: string; accessLevel: AccessLevel }>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(accessPolicies)
        .where(eq(accessPolicies.documentId, documentId));

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select({
          userId: accessPolicies.userId,
          accessLevel: accessPolicies.accessLevel,
        })
        .from(accessPolicies)
        .where(eq(accessPolicies.documentId, documentId))
        .limit(pageSize)
        .offset(offset - pageSize);

      const items = rawRows.map((row: any) => ({
        userId: row.userId,
        accessLevel: row.accessLevel as AccessLevel,
      }));

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

  async fetchDocumentsAccessibleByUser(
    userId: string,
    accessLevel: AccessLevel,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<{ documentId: string; accessLevel: AccessLevel }>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(accessPolicies)
        .where(
          and(
            eq(accessPolicies.userId, userId),
            eq(accessPolicies.accessLevel, accessLevel)
          )
        );

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select({
          documentId: accessPolicies.documentId,
          accessLevel: accessPolicies.accessLevel,
        })
        .from(accessPolicies)
        .where(
          and(
            eq(accessPolicies.userId, userId),
            eq(accessPolicies.accessLevel, accessLevel)
          )
        )
        .limit(pageSize)
        .offset(offset - pageSize);

      const items = rawRows.map((row: any) => ({
        documentId: row.documentId,
        accessLevel: row.accessLevel as AccessLevel,
      }));

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

  async existsByDocumentAndUser(documentId: string, userId: string): Promise<RepositoryResult<boolean>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(accessPolicies)
        .where(
          and(
            eq(accessPolicies.documentId, documentId),
            eq(accessPolicies.userId, userId)
          )
        );
      return Result.Ok(Number(row.value) > 0);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async hasAccessLevel(
    documentId: string,
    userId: string,
    minAccessLevel: AccessLevel
  ): Promise<RepositoryResult<boolean, AccessDeniedError>> {
    try {
      // Access levels are ordered: READ < WRITE < DELETE
      const levelHierarchy: Record<AccessLevel, number> = {
        [AccessLevel.READ]: 1,
        [AccessLevel.WRITE]: 2,
        [AccessLevel.DELETE]: 3,
      };

      const minLevel = levelHierarchy[minAccessLevel];

      // Fetch the user's access level for the document
      const raw = await this.db.query.accessPolicies.findFirst({
        where: and(
          eq(accessPolicies.documentId, documentId),
          eq(accessPolicies.userId, userId)
        ),
      });

      if (!raw) {
        return Result.Err(new AccessDeniedError(userId, documentId, minAccessLevel));
      }

      const userLevel = levelHierarchy[raw.accessLevel as AccessLevel];
      const hasAccess = userLevel >= minLevel;

      return Result.Ok(hasAccess);
    } catch (error) {
      return Result.Err(new AccessDeniedError(userId, documentId, minAccessLevel));
    }
  }

  async getAccessLevel(
    documentId: string,
    userId: string
  ): Promise<RepositoryResult<Option<AccessLevel>, AccessPolicyNotFoundError>> {
    try {
      const raw = await this.db.query.accessPolicies.findFirst({
        where: and(
          eq(accessPolicies.documentId, documentId),
          eq(accessPolicies.userId, userId)
        ),
      });

      if (!raw) {
        return Result.Err(new AccessPolicyNotFoundError(documentId, userId));
      }

      return Result.Ok(Option.Some(raw.accessLevel as AccessLevel));
    } catch (error) {
      return Result.Err(new AccessPolicyNotFoundError(documentId, userId));
    }
  }

  async delete(id: string): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>> {
    try {
      const existing = await this.fetchById(id);
      if (existing.isErr()) return existing;

      const maybePolicy = existing.unwrap();
      if (maybePolicy.isNone()) {
        return Result.Err(new AccessPolicyNotFoundError(id, id));
      }

      await this.db.delete(accessPolicies).where(eq(accessPolicies.id, id));
      return Result.Ok(maybePolicy);
    } catch (error) {
      return Result.Err(new AccessPolicyNotFoundError(id, id));
    }
  }

  async deleteByDocumentAndUser(
    documentId: string,
    userId: string
  ): Promise<RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError>> {
    try {
      const existing = await this.fetchByDocumentAndUser(documentId, userId);
      if (existing.isErr()) return existing;

      const maybePolicy = existing.unwrap();
      if (maybePolicy.isNone()) {
        return Result.Err(new AccessPolicyNotFoundError(documentId, userId));
      }

      await this.db
        .delete(accessPolicies)
        .where(
          and(
            eq(accessPolicies.documentId, documentId),
            eq(accessPolicies.userId, userId)
          )
        );

      return Result.Ok(maybePolicy);
    } catch (error) {
      return Result.Err(new AccessPolicyNotFoundError(documentId, userId));
    }
  }

  async deleteByDocumentId(documentId: string): Promise<RepositoryResult<number>> {
    try {
      const result = await this.db
        .delete(accessPolicies)
        .where(eq(accessPolicies.documentId, documentId))
        .returning({ id: accessPolicies.id });

      return Result.Ok(result.length);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async deleteByUserId(userId: string): Promise<RepositoryResult<number>> {
    try {
      const result = await this.db
        .delete(accessPolicies)
        .where(eq(accessPolicies.userId, userId))
        .returning({ id: accessPolicies.id });

      return Result.Ok(result.length);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }
}
