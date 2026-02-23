import type { Option } from "@carbonteq/fp";
import type {
	BaseRepository,
	RepositoryResult,
} from "@domain/shared/base.repository";
import type { User } from "./user.entity";
import type { UserAlreadyExistsError, UserNotFoundError } from "./user.errors";

/**
 * Minimal User repository.
 * Complex queries and search should be handled by application services.
 *
 * Error conventions:
 *  - fetch* methods: "not found" is modelled as Option.None (not an error).
 *    Err case = unexpected infrastructure failure (DbOperationError).
 *  - insert:  Err = UserAlreadyExistsError (unique constraint) | Error (infra failure)
 *  - update/delete: Err = UserNotFoundError (no matching row) | Error (infra failure)
 */
export interface UserRepository extends BaseRepository<User> {
	fetchById(id: string): Promise<RepositoryResult<Option<User>, Error>>;

	fetchByEmail(email: string): Promise<RepositoryResult<Option<User>, Error>>;

	insert(
		entity: User,
	): Promise<RepositoryResult<Option<User>, UserAlreadyExistsError | Error>>;

	update(
		entity: User,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError | Error>>;

	delete(
		id: string,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError | Error>>;
}
