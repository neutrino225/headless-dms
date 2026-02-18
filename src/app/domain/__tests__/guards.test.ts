import { describe, it, expect } from 'vitest';
import { isArchived, isOwner } from '@domain/document/document.guards';
import { isAdmin } from '@domain/user/user.guards';
import { hasAccess } from '@domain/access-policy/access-policy.guards';
import { AccessLevel } from '@domain/document/document.enums';
import { UserRole } from '@domain/user/user.enums';
import {
  makeDocument,
  makeArchivedDocument,
  makeUser,
  makeAdminUser,
  makeAccessPolicy,
  TEST_IDS,
} from './factories';

describe('document.guards', () => {
  describe('isArchived()', () => {
    it('returns true for an archived document', () => {
      expect(isArchived(makeArchivedDocument())).toBe(true);
    });

    it('returns false for an active document', () => {
      expect(isArchived(makeDocument())).toBe(false);
    });
  });

  describe('isOwner()', () => {
    it('returns true when the user is the document owner', () => {
      const doc = makeDocument({ ownerId: TEST_IDS.user1 });
      expect(isOwner(doc, TEST_IDS.user1)).toBe(true);
    });

    it('returns false when the user is not the owner', () => {
      const doc = makeDocument({ ownerId: TEST_IDS.user1 });
      expect(isOwner(doc, TEST_IDS.user2)).toBe(false);
    });
  });
});

describe('user.guards', () => {
  describe('isAdmin()', () => {
    it('returns true for an admin user', () => {
      expect(isAdmin(makeAdminUser())).toBe(true);
    });

    it('returns false for a regular user', () => {
      expect(isAdmin(makeUser({ role: UserRole.USER }))).toBe(false);
    });
  });
});

describe('access-policy.guards', () => {
  describe('hasAccess()', () => {
    it('READ policy grants READ access', () => {
      const policy = makeAccessPolicy({ accessLevel: AccessLevel.READ });
      expect(hasAccess(policy, AccessLevel.READ)).toBe(true);
    });

    it('READ policy denies WRITE access', () => {
      const policy = makeAccessPolicy({ accessLevel: AccessLevel.READ });
      expect(hasAccess(policy, AccessLevel.WRITE)).toBe(false);
    });

    it('READ policy denies DELETE access', () => {
      const policy = makeAccessPolicy({ accessLevel: AccessLevel.READ });
      expect(hasAccess(policy, AccessLevel.DELETE)).toBe(false);
    });

    it('WRITE policy grants READ access (hierarchy)', () => {
      const policy = makeAccessPolicy({ accessLevel: AccessLevel.WRITE });
      expect(hasAccess(policy, AccessLevel.READ)).toBe(true);
    });

    it('WRITE policy grants WRITE access', () => {
      const policy = makeAccessPolicy({ accessLevel: AccessLevel.WRITE });
      expect(hasAccess(policy, AccessLevel.WRITE)).toBe(true);
    });

    it('WRITE policy denies DELETE access', () => {
      const policy = makeAccessPolicy({ accessLevel: AccessLevel.WRITE });
      expect(hasAccess(policy, AccessLevel.DELETE)).toBe(false);
    });

    it('DELETE policy grants all access levels', () => {
      const policy = makeAccessPolicy({ accessLevel: AccessLevel.DELETE });
      expect(hasAccess(policy, AccessLevel.READ)).toBe(true);
      expect(hasAccess(policy, AccessLevel.WRITE)).toBe(true);
      expect(hasAccess(policy, AccessLevel.DELETE)).toBe(true);
    });
  });
});
