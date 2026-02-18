/**
 * Test factories for all domain entities.
 *
 * Follows the company testing standard (docs/testing_domain.md):
 * - Effect Schema with Faker annotations for realistic data generation
 * - FastCheck (via effect's Arbitrary) for sampling
 * - Scenario-based helper methods for common test cases
 * - Deterministic override support for specific assertions
 */

import { Arbitrary, FastCheck, Schema as S } from 'effect';
import { faker } from '@faker-js/faker';

import { Document } from '@domain/document/document.entity';
import { DocumentVersion } from '@domain/document/document-version.entity';
import { User } from '@domain/user/user.entity';
import { AccessPolicy } from '@domain/access-policy/access-policy.entity';
import {
  DocumentId,
  DocumentVersionId,
  UserId,
  AccessPolicyId,
} from '@domain/utils/refined-types';
import { AccessLevel } from '@domain/document/document.enums';
import { UserRole } from '@domain/user/user.enums';
import { refined } from './utils/arbitrary.utils';

// ─── Deterministic IDs (for assertions that need stable values) ───────────────

export const TEST_IDS = {
  user1: UserId.fromTrusted('00000000-0000-0000-0000-000000000001'),
  user2: UserId.fromTrusted('00000000-0000-0000-0000-000000000002'),
  adminUser: UserId.fromTrusted('00000000-0000-0000-0000-000000000003'),
  doc1: DocumentId.fromTrusted('10000000-0000-0000-0000-000000000001'),
  doc2: DocumentId.fromTrusted('10000000-0000-0000-0000-000000000002'),
  docVersion1: DocumentVersionId.fromTrusted('20000000-0000-0000-0000-000000000001'),
  policy1: AccessPolicyId.fromTrusted('30000000-0000-0000-0000-000000000001'),
} as const;

// ─── User ─────────────────────────────────────────────────────────────────────

const TestUserSchema = S.Struct({
  id: S.String.annotations(refined.uuid()),
  email: S.String.annotations(refined.email()),
  role: S.Literal(UserRole.USER, UserRole.ADMIN).annotations({
    arbitrary: () => (fc: any) => fc.constantFrom(UserRole.USER, UserRole.ADMIN),
  }),
  createdAt: S.String.annotations(refined.dateTime.past()),
  updatedAt: S.String.annotations(refined.dateTime.recent()),
});

type TestUserData = typeof TestUserSchema.Type;

function sampleUser(): TestUserData {
  const arb = Arbitrary.make(TestUserSchema);
  return FastCheck.sample(arb, { numRuns: 1 })[0]!;
}

export interface UserOverrides {
  id?: UserId;
  email?: string;
  role?: UserRole;
}

export function makeUser(overrides: UserOverrides = {}): User {
  const sample = sampleUser();
  return User.fromSerialized({
    id: overrides.id ?? sample.id,
    email: overrides.email ?? sample.email,
    role: overrides.role ?? UserRole.USER,
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt,
  });
}

export function makeAdminUser(overrides: UserOverrides = {}): User {
  return makeUser({ role: UserRole.ADMIN, ...overrides });
}

// ─── Document ─────────────────────────────────────────────────────────────────

const TestDocumentSchema = S.Struct({
  id: S.String.annotations(refined.uuid()),
  name: S.String.annotations({
    arbitrary: () => (fc: any) =>
      fc.constant(null).map(() => faker.system.fileName({ extensionCount: 0 })),
  }),
  ownerId: S.String.annotations(refined.uuid()),
  isArchived: S.Boolean.annotations({
    arbitrary: () => (fc: any) => fc.boolean(),
  }),
  createdAt: S.String.annotations(refined.dateTime.past()),
  updatedAt: S.String.annotations(refined.dateTime.recent()),
});

type TestDocumentData = typeof TestDocumentSchema.Type;

function sampleDocument(): TestDocumentData {
  const arb = Arbitrary.make(TestDocumentSchema);
  return FastCheck.sample(arb, { numRuns: 1 })[0]!;
}

export interface DocumentOverrides {
  id?: DocumentId;
  name?: string;
  ownerId?: UserId;
  isArchived?: boolean;
}

export function makeDocument(overrides: DocumentOverrides = {}): Document {
  const sample = sampleDocument();
  return Document.fromSerialized({
    id: overrides.id ?? sample.id,
    name: overrides.name ?? sample.name,
    ownerId: overrides.ownerId ?? sample.ownerId,
    isArchived: overrides.isArchived ?? false,
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt,
  });
}

export function makeArchivedDocument(overrides: DocumentOverrides = {}): Document {
  return makeDocument({ isArchived: true, ...overrides });
}

// ─── DocumentVersion ──────────────────────────────────────────────────────────

const TestDocumentVersionSchema = S.Struct({
  id: S.String.annotations(refined.uuid()),
  documentId: S.String.annotations(refined.uuid()),
  versionNumber: S.Number.annotations({
    arbitrary: () => (fc: any) => fc.integer({ min: 1, max: 100 }),
  }),
  storageKey: S.String.annotations(refined.storageKey()),
  mimeType: S.String.annotations(refined.mimeType()),
  fileSize: S.Number.annotations(refined.fileSize()),
  checksum: S.String.annotations(refined.checksum()),
  createdBy: S.String.annotations(refined.uuid()),
  createdAt: S.String.annotations(refined.dateTime.past()),
  updatedAt: S.String.annotations(refined.dateTime.past()),
});

type TestDocumentVersionData = typeof TestDocumentVersionSchema.Type;

function sampleDocumentVersion(): TestDocumentVersionData {
  const arb = Arbitrary.make(TestDocumentVersionSchema);
  return FastCheck.sample(arb, { numRuns: 1 })[0]!;
}

export interface DocumentVersionOverrides {
  id?: DocumentVersionId;
  documentId?: DocumentId;
  versionNumber?: number;
  storageKey?: string;
  mimeType?: string;
  fileSize?: number;
  checksum?: string;
  createdBy?: UserId;
}

export function makeDocumentVersion(overrides: DocumentVersionOverrides = {}): DocumentVersion {
  const sample = sampleDocumentVersion();
  return DocumentVersion.fromSerialized({
    id: overrides.id ?? sample.id,
    documentId: overrides.documentId ?? sample.documentId,
    versionNumber: overrides.versionNumber ?? sample.versionNumber,
    storageKey: overrides.storageKey ?? sample.storageKey,
    mimeType: overrides.mimeType ?? sample.mimeType,
    fileSize: overrides.fileSize ?? sample.fileSize,
    checksum: overrides.checksum ?? sample.checksum,
    createdBy: overrides.createdBy ?? sample.createdBy,
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt,
  });
}

// ─── AccessPolicy ─────────────────────────────────────────────────────────────

const TestAccessPolicySchema = S.Struct({
  id: S.String.annotations(refined.uuid()),
  documentId: S.String.annotations(refined.uuid()),
  userId: S.String.annotations(refined.uuid()),
  accessLevel: S.Literal(AccessLevel.READ, AccessLevel.WRITE, AccessLevel.DELETE).annotations({
    arbitrary: () => (fc: any) =>
      fc.constantFrom(AccessLevel.READ, AccessLevel.WRITE, AccessLevel.DELETE),
  }),
  createdAt: S.String.annotations(refined.dateTime.past()),
  updatedAt: S.String.annotations(refined.dateTime.recent()),
});

type TestAccessPolicyData = typeof TestAccessPolicySchema.Type;

function sampleAccessPolicy(): TestAccessPolicyData {
  const arb = Arbitrary.make(TestAccessPolicySchema);
  return FastCheck.sample(arb, { numRuns: 1 })[0]!;
}

export interface AccessPolicyOverrides {
  id?: AccessPolicyId;
  documentId?: DocumentId;
  userId?: UserId;
  accessLevel?: AccessLevel;
}

export function makeAccessPolicy(overrides: AccessPolicyOverrides = {}): AccessPolicy {
  const sample = sampleAccessPolicy();
  return AccessPolicy.fromSerialized({
    id: overrides.id ?? sample.id,
    documentId: overrides.documentId ?? sample.documentId,
    userId: overrides.userId ?? sample.userId,
    accessLevel: overrides.accessLevel ?? AccessLevel.READ,
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt,
  });
}
