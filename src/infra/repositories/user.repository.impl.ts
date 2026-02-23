import { Option, Result } from "@carbonteq/fp";
import type { RepositoryResult } from "@domain/shared/base.repository";
import { User } from "@domain/user/user.entity";
import {
	UserAlreadyExistsError,
	UserNotFoundError,
} from "@domain/user/user.errors";
import type { UserRepository } from "@domain/user/user.repository";
import { users } from "@infra/db/schema";
import { eq } from "drizzle-orm";
import { injectable } from "tsyringe";

type DrizzleDB = any;

@injectable()
export class UserRepositoryImpl implements UserRepository {
	constructor(private db: DrizzleDB) {}

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

	async insert(
		entity: User,
	): Promise<RepositoryResult<Option<User>, UserAlreadyExistsError>> {
		try {
			const dbData = this.toDbSerialized(entity);
			await this.db.insert(users).values(dbData);
			return Result.Ok(Option.Some(entity));
		} catch (_error) {
			return Result.Err(new UserAlreadyExistsError(entity.id.toString()));
		}
	}

	async update(
		entity: User,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError>> {
		try {
			const dbData = this.toDbSerialized(entity);
			const result = await this.db
				.update(users)
				.set(dbData)
				.where(eq(users.id, entity.id.toString()))
				.returning();

			if (result.length === 0) {
				return Result.Err(new UserNotFoundError(entity.id.toString()));
			}
			return Result.Ok(Option.Some(entity));
		} catch (_error) {
			return Result.Err(new UserNotFoundError(entity.id.toString()));
		}
	}

	async fetchByEmail(
		email: string,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError>> {
		try {
			const raw = await this.db.query.users.findFirst({
				where: eq(users.email, email),
			});
			return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
		} catch (_error) {
			return Result.Err(new UserNotFoundError(`email: ${email}`));
		}
	}

	async fetchById(
		id: string,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError>> {
		try {
			const raw = await this.db.query.users.findFirst({
				where: eq(users.id, id),
			});
			return Result.Ok(Option.fromNullable(raw).map(this.toDomain));
		} catch (_error) {
			return Result.Err(new UserNotFoundError(id));
		}
	}

	async delete(
		userId: string,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError>> {
		try {
			const existing = await this.fetchById(userId);
			if (existing.isErr()) return existing;

			const maybeUser = existing.unwrap();
			if (maybeUser.isNone()) {
				return Result.Err(new UserNotFoundError(userId));
			}

			await this.db.delete(users).where(eq(users.id, userId));
			return Result.Ok(maybeUser);
		} catch (_error) {
			return Result.Err(new UserNotFoundError(userId));
		}
	}

	async existsBy(_prop: string, _val: any): Promise<RepositoryResult<boolean>> {
		throw new Error("Method not implemented.");
	}
}
