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

import { Document } from 'src/domain/document/document.entity';
import { DocumentVersion } from 'src/domain/document/document-version.entity';
import { User } from 'src/domain/user/user.entity';
import { AccessPolicy } from 'src/domain/access-policy/access-policy.entity';
import { AuditLog } from 'src/domain/audit-log/audit-log.entity';
import {
  DocumentId,
  DocumentVersionId,
  UserId,
  AccessPolicyId,
} from 'src/domain/utils/refined-types';
import { AuditAction } from 'src/domain/audit-log/audit-log.enums';
import { AccessLevel, DocumentStatus } from 'src/domain/document/document.enums';
import { UserRole } from 'src/domain/user/user.enums';
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
  passwordHash: S.String.annotations({
    arbitrary: () => (fc: any) =>
      fc.constant('$2b$10$hashedpasswordfortesting1234567890abcdef'),
  }),
  role: S.Literal(UserRole.USER, UserRole.ADMIN).annotations({
    arbitrary: () => (fc: any) => fc.constantFrom(UserRole.USER, UserRole.ADMIN),
  }),
  displayName: S.NullOr(S.String).annotations({
    arbitrary: () => (fc: any) =>
      fc.option(fc.constant(null).map(() => faker.person.fullName()), { nil: null }),
  }),
  isActive: S.Boolean.annotations({
    arbitrary: () => (fc: any) => fc.constant(true),
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
  passwordHash?: string;
  role?: UserRole;
  displayName?: string | null;
  isActive?: boolean;
}

export function makeUser(overrides: UserOverrides = {}): User {
  const sample = sampleUser();
  return User.fromSerialized({
    id: overrides.id ?? sample.id,
    email: overrides.email ?? sample.email,
    passwordHash: overrides.passwordHash ?? sample.passwordHash,
    role: overrides.role ?? UserRole.USER,
    displayName: overrides.displayName !== undefined ? overrides.displayName : sample.displayName,
    isActive: overrides.isActive ?? true,
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
  description: S.NullOr(S.String).annotations({
    arbitrary: () => (fc: any) =>
      fc.option(fc.constant(null).map(() => faker.lorem.sentence()), { nil: null }),
  }),
  ownerId: S.String.annotations(refined.uuid()),
  slug: S.String.annotations({
    arbitrary: () => (fc: any) =>
      fc.constant(null).map(() => faker.helpers.slugify(faker.lorem.words(3))),
  }),
  mimeType: S.String.annotations(refined.mimeType()),
  status: S.Literal(DocumentStatus.Active, DocumentStatus.Archived, DocumentStatus.Deleted).annotations({
    arbitrary: () => (fc: any) => fc.constant(DocumentStatus.Active),
  }),
  latestVersionId: S.NullOr(S.String).annotations({
    arbitrary: () => (fc: any) => fc.constant(null),
  }),
  metadata: S.NullOr(S.Record({ key: S.String, value: S.Unknown })).annotations({
    arbitrary: () => (fc: any) => fc.constant(null),
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
  description?: string | null;
  ownerId?: UserId;
  slug?: string;
  mimeType?: string;
  status?: DocumentStatus;
  latestVersionId?: DocumentVersionId | null;
  metadata?: Record<string, unknown> | null;
}

export function makeDocument(overrides: DocumentOverrides = {}): Document {
  const sample = sampleDocument();
  return Document.fromSerialized({
    id: overrides.id ?? sample.id,
    name: overrides.name ?? sample.name,
    description: overrides.description !== undefined ? overrides.description : sample.description,
    ownerId: overrides.ownerId ?? sample.ownerId,
    slug: overrides.slug ?? sample.slug,
    mimeType: overrides.mimeType ?? sample.mimeType,
    status: overrides.status ?? DocumentStatus.Active,
    latestVersionId: overrides.latestVersionId !== undefined ? overrides.latestVersionId : null,
    metadata: overrides.metadata !== undefined ? overrides.metadata : sample.metadata,
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt,
  });
}

export function makeDocumentWithStatus(status: DocumentStatus, overrides: DocumentOverrides = {}): Document {
  return makeDocument({ status, ...overrides });
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
  sizeBytes: S.Number.annotations(refined.fileSize()),
  checksum: S.String.annotations(refined.checksum()),
  uploadedBy: S.String.annotations(refined.uuid()),
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
  sizeBytes?: number;
  checksum?: string;
  uploadedBy?: UserId;
}

export function makeDocumentVersion(overrides: DocumentVersionOverrides = {}): DocumentVersion {
  const sample = sampleDocumentVersion();
  return DocumentVersion.fromSerialized({
    id: overrides.id ?? sample.id,
    documentId: overrides.documentId ?? sample.documentId,
    versionNumber: overrides.versionNumber ?? sample.versionNumber,
    storageKey: overrides.storageKey ?? sample.storageKey,
    mimeType: overrides.mimeType ?? sample.mimeType,
    sizeBytes: overrides.sizeBytes ?? sample.sizeBytes,
    checksum: overrides.checksum ?? sample.checksum,
    uploadedBy: overrides.uploadedBy ?? sample.uploadedBy,
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

// ─── AuditLog ─────────────────────────────────────────────────────────────────

const TestAuditLogSchema = S.Struct({
  id: S.String.annotations(refined.uuid()),
  userId: S.String.annotations(refined.uuid()),
  action: S.String.annotations({
    arbitrary: () => (fc: any) =>
      fc.constantFrom(...Object.values(AuditAction)),
  }),
  resourceId: S.String.annotations(refined.uuid()),
  resourceType: S.Literal('document', 'user', 'policy').annotations({
    arbitrary: () => (fc: any) => fc.constantFrom('document', 'user', 'policy'),
  }),
  metadata: S.NullOr(S.Record({ key: S.String, value: S.Unknown })).annotations({
    arbitrary: () => (fc: any) =>
      fc.option(
        fc.record({
          previousStatus: fc.constant('active'),
          newStatus: fc.constant('archived'),
        }),
        { nil: null }
      ),
  }),
  createdAt: S.String.annotations(refined.dateTime.past()),
  updatedAt: S.String.annotations(refined.dateTime.recent()),
});

type TestAuditLogData = typeof TestAuditLogSchema.Type;

function sampleAuditLog(): TestAuditLogData {
  const arb = Arbitrary.make(TestAuditLogSchema);
  return FastCheck.sample(arb, { numRuns: 1 })[0]!;
}

export interface AuditLogOverrides {
  id?: string;
  userId?: string;
  action?: AuditAction | string;
  resourceId?: string;
  resourceType?: 'document' | 'user' | 'policy';
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export function makeAuditLog(overrides: AuditLogOverrides = {}): AuditLog {
  const sample = sampleAuditLog();
  return AuditLog.fromSerialized({
    id: overrides.id ?? sample.id,
    userId: overrides.userId ?? sample.userId,
    action: overrides.action ?? sample.action,
    resourceId: overrides.resourceId ?? sample.resourceId,
    resourceType: overrides.resourceType ?? sample.resourceType,
    metadata: overrides.metadata !== undefined ? overrides.metadata : sample.metadata,
    createdAt: overrides.createdAt ?? sample.createdAt,
    updatedAt: overrides.updatedAt ?? sample.updatedAt,
  });
}
