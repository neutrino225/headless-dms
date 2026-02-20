import { Result, Option } from "@carbonteq/fp";
import { User } from "./user.entity";
import {
    UserNotFoundError,
    EmailAlreadyTakenError,
    UserDomainError,
    UserUnauthorizedError,
    UserValidationError,
    UserAlreadyExistsError,
} from "./user.errors";

import { BaseRepository, RepositoryResult } from "@domain/shared/base.repository";
import { UserRole } from "./user.enums";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";

/**
 * Minimal User repository.
 * Complex queries and search should be handled by application services.
 */
export interface UserRepository extends BaseRepository<User> {
    fetchById(id: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;
    
    fetchByEmail(email: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;

    insert(entity: User): Promise<RepositoryResult<Option<User>, UserAlreadyExistsError>>;
    
    update(entity: User): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;

    delete(id: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;
}
