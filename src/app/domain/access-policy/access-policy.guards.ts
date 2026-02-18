import { AccessPolicy } from './access-policy.entity';
import { AccessLevel } from '@domain/document/document.enums';

/**
 * Guards for the AccessPolicy domain.
 * Pure predicate functions — no side effects, no IO.
 */

/**
 * Returns true if the policy grants at least the requested access level.
 * Hierarchy: DELETE > WRITE > READ
 */
export function hasAccess(policy: AccessPolicy, requiredLevel: AccessLevel): boolean {
  const hierarchy: AccessLevel[] = [AccessLevel.READ, AccessLevel.WRITE, AccessLevel.DELETE];
  const policyIndex = hierarchy.indexOf(policy.accessLevel);
  const requiredIndex = hierarchy.indexOf(requiredLevel);
  return policyIndex >= requiredIndex;
}

/**
 * Returns true if the policy is for the given user.
 */
export function isForUser(policy: AccessPolicy, userId: string): boolean {
  return policy.userId === userId;
}
