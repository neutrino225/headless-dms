import { UnauthorizedError, NotFoundError } from '@domain/shared/domain.error';
import { AccessLevel } from '@domain/document/document.enums';

/**
 * Errors for the DocumentAccessService.
 * Raised when access evaluation fails — distinct from AccessPolicy domain errors
 * which concern the policy record itself (not found, etc.).
 */

/**
 * Raised when a user attempts an action they do not have permission for.
 * Covers all four denial paths: no policy, insufficient level, not owner, not admin.
 */
export class DocumentAccessDeniedError extends UnauthorizedError {
  readonly code = 'DOCUMENT_ACCESS_DENIED';

  constructor(userId: string, documentId: string, requiredLevel: AccessLevel) {
    super(
      `User ${userId} does not have ${requiredLevel} access on document ${documentId}`,
    );
  }
}

/**
 * Raised when access check is attempted but no policy exists for the user/document pair
 * and the user is neither the owner nor an admin.
 */
export class NoAccessPolicyError extends NotFoundError {
  readonly code = 'NO_ACCESS_POLICY';

  constructor(userId: string, documentId: string) {
    super(
      `No access policy found for user ${userId} on document ${documentId}`,
    );
  }
}

export type DocumentAccessError =
  | DocumentAccessDeniedError
  | NoAccessPolicyError;
