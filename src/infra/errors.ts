/**
 * Infrastructure error hierarchy.
 *
 * These errors represent failures inside the infrastructure layer
 * (database, object storage, network, etc). They must NEVER cross
 * the application (workflow) boundary — workflows map them to
 * WorkflowInfraError before surfacing them to the presentation layer.
 *
 * Rule: RepoError is infra-vocabulary only.
 */

/**
 * Raised when a database operation fails unexpectedly (connection lost,
 * query timeout, driver error, etc). Distinct from "row not found" — that
 * is modelled as Option.None in the success branch.
 */
export class DbOperationError extends Error {
	readonly code = "DB_OPERATION_ERROR";

	constructor(operation: string, cause?: unknown) {
		super(`Database operation failed: ${operation}`);
		this.name = "DbOperationError";
		if (cause !== undefined) this.cause = cause;
	}
}
