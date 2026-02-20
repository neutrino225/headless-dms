import { AuditLog } from "@domain/audit-log/audit-log.entity";
import { AuditLogRepository } from "@domain/audit-log/audit-log.repository";
import { eq } from "drizzle-orm";
import { auditLogs } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";

type DrizzleDB = any;

@injectable()
export class AuditLogRepositoryImpl implements AuditLogRepository {
  constructor(private db: DrizzleDB) {}

  private toDbSerialized(log: AuditLog): any {
    return {
      ...log.serialize(),
      createdAt: log.createdAt.toDate(),
      updatedAt: log.updatedAt.toDate(),
    };
  }

  private toDomain(raw: any): AuditLog {
    return AuditLog.fromSerialized(raw);
  }

  async insert(entity: AuditLog): Promise<RepositoryResult<Option<AuditLog>, Error>> {
    try {
      const dbData = this.toDbSerialized(entity);
      await this.db.insert(auditLogs).values(dbData);
      return Result.Ok(Option.Some(entity));
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async fetchById(id: string): Promise<RepositoryResult<Option<AuditLog>, Error>> {
    try {
      const raw = await this.db.query.auditLogs.findFirst({
        where: eq(auditLogs.id, id),
      });
      return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
    } catch (error) {
      return Result.Err(error as Error);
    }
  }
}


