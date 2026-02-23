/**
 * Application-layer error vocabulary.
 *
 * These errors are emitted by workflows (application layer). They wrap
 * lower-level infrastructure failures in a stable, presentation-agnostic
 * vocabulary — following the "one layer deep" rule from the multi-level
 * error handling guidelines.
 */

import { DomainError } from "@domain/shared/base.errors";

/**
 * Emitted by a workflow when an infrastructure failure (database down,
 * connection timeout, storage service unavailable) prevents the operation
 * from completing.
 *
 * Workflows MUST catch DbOperationError / raw Error from repository calls
 * and re-emit this error so the presentation layer never sees infra details.
 *
 * Maps to HTTP 500 INTERNAL_SERVER_ERROR at the presentation boundary.
 */
export class WorkflowInfraError extends DomainError {
	readonly code = "WORKFLOW_INFRA_ERROR";

	constructor(readonly operation: string) {
		super(`Service temporarily unavailable (${operation})`);
	}
}
