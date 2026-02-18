import { User } from './user.entity';
import { UserRole } from './user.enums';

/**
 * Guards for the User domain.
 * Pure predicate functions — no side effects, no IO.
 */

/**
 * Returns true if the user has the ADMIN role.
 */
export function isAdmin(user: User): boolean {
  return user.role === UserRole.ADMIN;
}
