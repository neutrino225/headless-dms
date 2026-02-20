import { User } from "@domain/user/user.entity";
import { UserNotFoundError, UserAlreadyExistsError } from "@domain/user/user.errors";
import { UserRepository } from "@domain/user/user.repository";
import { eq } from "drizzle-orm";
import { users } from "@infra/db/schema";
import { injectable } from "tsyringe";
import { Result, Option } from "@carbonteq/fp";
import { RepositoryResult } from "@domain/shared/base.repository";

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
        throw new Error("Method not implemented.");
    }
}
