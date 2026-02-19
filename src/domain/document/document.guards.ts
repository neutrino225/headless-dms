import { Document } from './document.entity';
import { UserId } from 'src/domain/utils/refined-types';

/**
 * Guards for the Document domain.
 * Pure predicate functions — no side effects, no IO.
 */

/**
 * Returns true if the document has been archived (soft-deleted).
 */
export function isArchived(doc: Document): boolean {
  return doc.isArchived;
}

/**
 * Returns true if the given user is the owner of the document.
 */
export function isOwner(doc: Document, userId: UserId): boolean {
  return UserId.toString(doc.ownerId) === UserId.toString(userId);
}
