import { AccessPolicy } from "@domain/access-policy/access-policy.entity";
import { AccessPolicyRepository } from "@domain/access-policy/access-policy.repository";
import { AccessPolicyNotFoundError } from "@domain/access-policy/access-policy.errors";
import { and, eq } from "drizzle-orm";
import { accessPolicies } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";

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
}
