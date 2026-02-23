import type { Option, Result } from "@carbonteq/fp";
import type { BaseEntity } from "./base.entity";
import type { AlreadyExistsError, NotFoundError } from "./base.errors";
import type { Paginated, PaginationOptions } from "./pagination";

export type RepositoryResult<T, E = Error> = Result<T, E>;

export abstract class BaseRepository<T extends BaseEntity<string>> {
	abstract insert(
		entity: T,
	): Promise<RepositoryResult<Option<T>, AlreadyExistsError>>;
	abstract update(
		entity: T,
	): Promise<RepositoryResult<Option<T>, NotFoundError>>;

	fetchAll?(): Promise<RepositoryResult<Option<T[]>>>;
	fetchPaginated?(
		options: PaginationOptions,
	): Promise<RepositoryResult<Option<Paginated<T>>>>;
	fetchById?(id: string): Promise<RepositoryResult<Option<T>, NotFoundError>>;
	deleteById?(id: string): Promise<RepositoryResult<Option<T>, NotFoundError>>;
	fetchBy?<U extends keyof T>(
		prop: U,
		val: T[U],
	): Promise<RepositoryResult<Option<T>, NotFoundError>>;
	existsBy?(prop: string, val: any): Promise<RepositoryResult<boolean>>;
	deleteBy?<U extends keyof T>(
		prop: U,
		val: T[U],
	): Promise<RepositoryResult<Option<T>, NotFoundError>>;
}
