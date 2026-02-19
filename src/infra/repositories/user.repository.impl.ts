import { User } from "@domain/user/user.entity";
import { UserNotFoundError, UserAlreadyExistsError, EmailAlreadyTakenError, UserDomainError, UserUnauthorizedError, UserValidationError } from "@domain/user/user.errors";
import { UserRepository } from "@domain/user/user.repository";
import { and, count, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { users } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { UserRole } from "@domain/user/user.enums";

type DrizzleDB = any;

@injectable()
export class UserRepositoryImpl implements UserRepository {
    constructor(
        private db: DrizzleDB,
    ) {}

    // Serialization: Domain -> Persistence
    private toDbSerialized(user: User): any {
        return {
            ...user.serialize(),
            createdAt: user.createdAt.toDate(),
            updatedAt: user.updatedAt.toDate(),
        };
    }

    // Rehydration: Persistence -> Domain
    private toDomain(raw: any): User {
        return User.fromSerialized(raw);
    }

    async insert(entity: User): Promise<RepositoryResult<Option<User>, UserAlreadyExistsError>> {
        try {
            const dbData = this.toDbSerialized(entity);
            await this.db.insert(users).values(dbData);
            return Result.Ok(Option.Some(entity));
        } catch (error) {
            return Result.Err(new UserAlreadyExistsError(entity.id.toString()));
        }
    }

    async update(entity: User): Promise<RepositoryResult<Option<User>, UserNotFoundError>> {
        try {
            const dbData = this.toDbSerialized(entity);
            const result = await this.db.update(users)
                .set(dbData)
                .where(eq(users.id, entity.id.toString()))
                .returning();
            
            if (result.length === 0) {
                return Result.Err(new UserNotFoundError(entity.id.toString()));
            }
            return Result.Ok(Option.Some(entity));
        } catch (error) {
            return Result.Err(new UserNotFoundError(entity.id.toString()));
        }
    }

    async fetchByEmail(email: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>> {
        try {
            const raw = await this.db.query.users.findFirst({
                where: eq(users.email, email),
            });
            return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
        } catch (error) {
            return Result.Err(new UserNotFoundError(`email: ${email}`));
        }
    }

    async fetchById(id: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>> {
        try {
            const raw = await this.db.query.users.findFirst({
                where: eq(users.id, id),
            });
            return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
        } catch (error) {
            return Result.Err(new UserNotFoundError(id));
        }
    }

    async existsByEmail(email: string): Promise<RepositoryResult<boolean>> {
        try {
            const [row] = await this.db.select({ value: count() }).from(users).where(eq(users.email, email));
            return Result.Ok(Number(row.value) > 0);
        } catch (error) {
            return Result.Err(error as Error);
        }
    }

    async fetchActiveUsers(options: PaginationOptions): Promise<RepositoryResult<Paginated<User>>> {
        return this.fetchPaginatedInternal(options, eq(users.isActive, true));
    }

    async fetchInactiveUsers(options: PaginationOptions): Promise<RepositoryResult<Paginated<User>>> {
        return this.fetchPaginatedInternal(options, eq(users.isActive, false));
    }

    async fetchByRole(role: UserRole, options: PaginationOptions): Promise<RepositoryResult<Paginated<User>>> {
        return this.fetchPaginatedInternal(options, eq(users.role, role));
    }

    async search(query: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<User>>> {
        const searchExpr = or(
            ilike(users.email, `%${query}%`),
            ilike(users.displayName, `%${query}%`)
        );
        return this.fetchPaginatedInternal(options, searchExpr);
    }

    private async fetchPaginatedInternal(
        options: PaginationOptions,
        whereClause?: any
    ): Promise<RepositoryResult<Paginated<User>>> {
        try {
            const { pageSize, offset, pageNum } = options;

            // Get total count
            const [countRow] = await this.db
                .select({ total: count() })
                .from(users)
                .where(whereClause);
            
            const totalItems = Number(countRow.total);
            const totalPages = Math.ceil(totalItems / pageSize) || 1;

            // Get data
            const rawRows = await this.db
                .select()
                .from(users)
                .where(whereClause)
                .limit(pageSize)
                .offset(offset - pageSize); // PaginationOptions.offset is pageNum * pageSize, we need (pageNum-1) * pageSize for 1-based indexing if that's how it's used
            
            // Wait, let's re-verify PaginationOptions.offset
            /*
            private constructor(readonly pageNum: number, readonly pageSize: number) {
                this.offset = pageSize * pageNum;
            }
            */
            // If pageNum = 1, pageSize = 10, offset = 10.
            // Drizzle offset 0 is page 1.
            // So offset - pageSize is (10 - 10) = 0. Correct.

            const items = rawRows.map(this.toDomain);

            return Result.Ok({
                data: items,
                pageNum,
                pageSize,
                totalPages
            });
        } catch (error) {
            return Result.Err(error as Error);
        }
    }

    async register(user: User): Promise<RepositoryResult<Option<User>, EmailAlreadyTakenError | UserDomainError>> {
        // In a real system, register might involve more than just insert, 
        // but for now we'll match the interface's intent.
        try {
            const dbData = this.toDbSerialized(user);
            await this.db.insert(users).values(dbData);
            return Result.Ok(Option.Some(user));
        } catch (error) {
            return Result.Err(new EmailAlreadyTakenError(user.email.toString()));
        }
    }

    async delete(userId: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>> {
        try {
            const existing = await this.fetchById(userId);
            if (existing.isErr()) return existing;
            
            const maybeUser = existing.unwrap();
            if (maybeUser.isNone()) {
                return Result.Err(new UserNotFoundError(userId));
            }

            await this.db.delete(users).where(eq(users.id, userId));
            return Result.Ok(maybeUser);
        } catch (error) {
            return Result.Err(new UserNotFoundError(userId));
        }
    }

    async existsBy(prop: string, val: any): Promise<RepositoryResult<boolean>> {
        try {
            // Very generic existsBy implementation
            const [row] = await this.db
                .select({ value: count() })
                .from(users)
                .where(eq(sql.raw(prop), val));
            return Result.Ok(Number(row.value) > 0);
        } catch (error) {
            return Result.Err(error as Error);
        }
    }
}
