import { User } from '@domain/user/user.entity';
import { Document } from '@domain/document/document.entity';
import { AccessPolicy } from '@domain/access-policy/access-policy.entity';
import { AccessLevel } from '@domain/document/document.enums';
import { isAdmin } from '@domain/user/user.guards';
import { isOwner } from '@domain/document/document.guards';
import { hasAccess } from '@domain/access-policy/access-policy.guards';
import { UserId } from '@domain/utils/refined-types';

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
 * This service is pure: no IO, no side effects, fully deterministic.
 */
export function canAccess(
  user: User,
  document: Document,
  policies: AccessPolicy[],
  action: AccessLevel,
): boolean {
  // 1. Admins have unrestricted access
  if (isAdmin(user)) {
    return true;
  }

  // 2. Document owner has unrestricted access
  if (isOwner(document, user.id as UserId)) {
    return true;
  }

  // 3. Check explicit subject-level policy for this user on this document
  const subjectPolicy = policies.find(
    (p) =>
      UserId.toString(p.userId) === UserId.toString(user.id as UserId) &&
      p.documentId === document.id,
  );

  if (subjectPolicy) {
    return hasAccess(subjectPolicy, action);
  }

  // 4. Default deny
  return false;
}
