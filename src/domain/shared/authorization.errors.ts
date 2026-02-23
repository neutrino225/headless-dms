/**
 * Authorization errors.
 *
 * Raised by use-case (workflow) methods when RBAC checks fail.
 * These extend ForbiddenError so the error-mapper translates them
 * to HTTP 403 FORBIDDEN responses.
 */

import { ForbiddenError } from "./base.errors";

/**
 * The caller does not have sufficient permissions to perform the requested action.
 * Covers owner-or-admin checks on document mutations.
 */
export class InsufficientPermissionsError extends ForbiddenError {
	readonly code = "INSUFFICIENT_PERMISSIONS";

	constructor(action: string, resourceId?: string) {
		super(
			resourceId
				? `Not authorized to ${action} resource ${resourceId}`
				: `Not authorized to ${action}`,
		);
	}
}

/**
 * The operation requires the ADMIN role and the caller is not an admin.
 */
export class AdminRequiredError extends ForbiddenError {
	readonly code = "ADMIN_REQUIRED";

	constructor(action: string) {
		super(`Admin role required to ${action}`);
	}
}
