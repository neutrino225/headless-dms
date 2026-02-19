import { Result } from '@carbonteq/fp';
import { User } from 'src/domain/user/user.entity';
import { Document } from 'src/domain/document/document.entity';
import { AccessPolicy } from 'src/domain/access-policy/access-policy.entity';
import { AccessLevel } from 'src/domain/document/document.enums';
import { isAdmin } from 'src/domain/user/user.guards';
import { isOwner } from 'src/domain/document/document.guards';
import { hasAccess } from 'src/domain/access-policy/access-policy.guards';
import { UserId } from 'src/domain/utils/refined-types';
import {
  DocumentAccessDeniedError,
  DocumentAccessError,
  NoAccessPolicyError,
} from './document-access.errors';

/**
 * DocumentAccessService — pure domain service.
 *
 * Evaluates whether a user has a given access level on a document.
 *
 * Precedence (highest to lowest):
 *   1. ADMIN role → always allowed
 *   2. Document owner → always allowed
 *   3. Explicit subject policy (AccessPolicy for this user/document) → check level
 *   4. Default → deny
 *
 * Returns Result.Ok(undefined) when access is granted.
 * Returns Result.Err with the specific denial reason when access is refused.
 *
 * This service is pure: no IO, no side effects, fully deterministic.
 */
export function canAccess(
  user: User,
  document: Document,
  policies: AccessPolicy[],
  action: AccessLevel,
): Result<void, DocumentAccessError> {
  const userId = UserId.toString(user.id as UserId);
  const documentId = document.id as string;

  // 1. Admins have unrestricted access
  if (isAdmin(user)) {
    return Result.Ok(undefined);
  }

  // 2. Document owner has unrestricted access
  if (isOwner(document, user.id as UserId)) {
    return Result.Ok(undefined);
  }

  // 3. Check explicit subject-level policy for this user on this document
  const subjectPolicy = policies.find(
    (p) =>
      UserId.toString(p.userId) === userId &&
      p.documentId === document.id,
  );

  if (subjectPolicy) {
    return hasAccess(subjectPolicy, action)
      ? Result.Ok(undefined)
      : Result.Err(new DocumentAccessDeniedError(userId, documentId, action));
  }

  // 4. No policy exists at all — default deny
  return Result.Err(new NoAccessPolicyError(userId, documentId));
}
