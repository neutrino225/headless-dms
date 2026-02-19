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

export interface UserRepository extends BaseRepository<User> {
    fetchByEmail(email: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;
    fetchById(id: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;

    existsByEmail(email: string): Promise<RepositoryResult<boolean>>;

    fetchActiveUsers(options: PaginationOptions): Promise<RepositoryResult<Paginated<User>>>;
    fetchInactiveUsers(options: PaginationOptions): Promise<RepositoryResult<Paginated<User>>>;

    fetchByRole(role: UserRole, options: PaginationOptions): Promise<RepositoryResult<Paginated<User>>>;
    search(query: string, options: PaginationOptions): Promise<RepositoryResult<Paginated<User>>>;

    register(user: User): Promise<RepositoryResult<Option<User>, EmailAlreadyTakenError | UserDomainError>>;

    insert(entity: User): Promise<RepositoryResult<Option<User>, UserAlreadyExistsError>>;
    update(entity: User): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;

    delete(id: string): Promise<RepositoryResult<Option<User>, UserNotFoundError>>;
}
