import { AuditLog } from "@domain/audit-log/audit-log.entity";
import { AuditLogRepository, AuditResourceType } from "@domain/audit-log/audit-log.repository";
import { AuditAction } from "@domain/audit-log/audit-log.enums";
import { and, count, eq, gte, lte, sql, ilike, or } from "drizzle-orm";
import { auditLogs } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";

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

  async fetchByUserId(userId: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId));

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId))
        .orderBy(sql`${auditLogs.createdAt} DESC`)
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

  async fetchByResource(
    resourceId: string,
    resourceType: AuditResourceType,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<AuditLog>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.resourceId, resourceId),
            eq(auditLogs.resourceType, resourceType)
          )
        );

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.resourceId, resourceId),
            eq(auditLogs.resourceType, resourceType)
          )
        )
        .orderBy(sql`${auditLogs.createdAt} DESC`)
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

  async fetchByResourceType(
    resourceType: AuditResourceType,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<AuditLog>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(auditLogs)
        .where(eq(auditLogs.resourceType, resourceType));

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.resourceType, resourceType))
        .orderBy(sql`${auditLogs.createdAt} DESC`)
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

  async fetchByAction(action: AuditAction, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(auditLogs)
        .where(eq(auditLogs.action, action));

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, action))
        .orderBy(sql`${auditLogs.createdAt} DESC`)
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

  async fetchByDateRange(
    startDate: Date,
    endDate: Date,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<AuditLog>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.createdAt, startDate),
            lte(auditLogs.createdAt, endDate)
          )
        );

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.createdAt, startDate),
            lte(auditLogs.createdAt, endDate)
          )
        )
        .orderBy(sql`${auditLogs.createdAt} DESC`)
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

  async fetchByUserAndResource(
    userId: string,
    resourceId: string,
    options: PaginationOptions
  ): Promise<RepositoryResult<Paginated<AuditLog>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      const [countRow] = await this.db
        .select({ total: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.userId, userId),
            eq(auditLogs.resourceId, resourceId)
          )
        );

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.userId, userId),
            eq(auditLogs.resourceId, resourceId)
          )
        )
        .orderBy(sql`${auditLogs.createdAt} DESC`)
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

  async search(query: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<AuditLog>>> {
    try {
      const { pageSize, offset, pageNum } = options;

      // Search in action or metadata JSON
      const searchExpr = or(
        ilike(auditLogs.action, `%${query}%`),
        sql`${auditLogs.metadata}::text ILIKE ${`%${query}%`}`
      );

      const [countRow] = await this.db
        .select({ total: count() })
        .from(auditLogs)
        .where(searchExpr);

      const totalItems = Number(countRow.total);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      const rawRows = await this.db
        .select()
        .from(auditLogs)
        .where(searchExpr)
        .orderBy(sql`${auditLogs.createdAt} DESC`)
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

  async countByUserId(userId: string): Promise<RepositoryResult<number>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId));
      return Result.Ok(Number(row.value));
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async countByResource(resourceId: string, resourceType: AuditResourceType): Promise<RepositoryResult<number>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.resourceId, resourceId),
            eq(auditLogs.resourceType, resourceType)
          )
        );
      return Result.Ok(Number(row.value));
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async countByDateRange(startDate: Date, endDate: Date): Promise<RepositoryResult<number>> {
    try {
      const [row] = await this.db
        .select({ value: count() })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.createdAt, startDate),
            lte(auditLogs.createdAt, endDate)
          )
        );
      return Result.Ok(Number(row.value));
    } catch (error) {
      return Result.Err(error as Error);
    }
  }
}


