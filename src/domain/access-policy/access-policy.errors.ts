import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "@domain/shared/base.errors";

export class AccessPolicyNotFoundError extends NotFoundError {
	readonly code = "ACCESS_POLICY_NOT_FOUND";

	constructor(documentId: string, userId: string) {
		super(
			`No access policy found for user ${userId} on document ${documentId}`,
		);
	}
}

export class AccessDeniedError extends ForbiddenError {
	readonly code = "ACCESS_DENIED";

	constructor(userId: string, documentId: string, action: string) {
		super(
			`User ${userId} does not have ${action} access on document ${documentId}`,
		);
	}
}

export class AccessPolicyValidationError extends ValidationError {
	readonly code = "ACCESS_POLICY_VALIDATION_ERROR";
}

export type AccessPolicyDomainError =
	| AccessPolicyNotFoundError
	| AccessDeniedError
	| AccessPolicyValidationError;
