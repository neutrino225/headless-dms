import type { Option } from "@carbonteq/fp";
import type { AccessPolicy } from "@domain/access-policy/access-policy.entity";
import type { AccessPolicyNotFoundError } from "@domain/access-policy/access-policy.errors";
import type { RepositoryResult } from "@domain/shared/base.repository";

/**
 * Minimal AccessPolicy repository.
 * Complex queries should be handled by application services.
 *
 * Error conventions:
 *  - fetchById / fetchByDocumentAndUser: "not found" is Option.None; Err = infra failure.
 *  - insert: Err = Error (constraint violation or infra failure)
 *  - update / delete: Err = AccessPolicyNotFoundError | Error
 */
export interface AccessPolicyRepository {
	fetchById(id: string): Promise<RepositoryResult<Option<AccessPolicy>, Error>>;

	fetchByDocumentAndUser(
		documentId: string,
		userId: string,
	): Promise<RepositoryResult<Option<AccessPolicy>, Error>>;

	insert(
		entity: AccessPolicy,
	): Promise<RepositoryResult<Option<AccessPolicy>, Error>>;

	update(
		entity: AccessPolicy,
	): Promise<
		RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError | Error>
	>;

	delete(
		id: string,
	): Promise<
		RepositoryResult<Option<AccessPolicy>, AccessPolicyNotFoundError | Error>
	>;
}
