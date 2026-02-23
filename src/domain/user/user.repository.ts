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
 */
export interface UserRepository extends BaseRepository<User> {
	fetchById(
		id: string,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;

	fetchByEmail(
		email: string,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;

	insert(
		entity: User,
	): Promise<RepositoryResult<Option<User>, UserAlreadyExistsError>>;

	update(
		entity: User,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;

	delete(
		id: string,
	): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;
}
