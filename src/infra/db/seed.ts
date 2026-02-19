/**
 * Seed script — inserts deterministic test data for local development.
 *
 * Run with:  bun run db:seed
 *
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING so existing rows
 * are left untouched.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users, documents, documentVersions, accessPolicies, auditLogs } from './schema';
import { UserRole } from 'src/domain/user/user.enums';
import { AccessLevel } from 'src/domain/document/document.enums';
import { AuditAction } from 'src/domain/audit-log/audit-log.enums';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ── Deterministic seed IDs ────────────────────────────────────────────────────

const SEED = {
  adminId:    '00000000-0000-0000-0000-000000000001',
  userId:     '00000000-0000-0000-0000-000000000002',
  docId:      '10000000-0000-0000-0000-000000000001',
  versionId:  '20000000-0000-0000-0000-000000000001',
  policyId:   '30000000-0000-0000-0000-000000000001',
  auditId:    '40000000-0000-0000-0000-000000000001',
} as const;

const NOW = new Date();

async function seed() {
  console.log('Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────────
  await db.insert(users).values([
    {
      id: SEED.adminId,
      email: 'admin@headless-dms.dev',
      // bcrypt hash of 'admin123' (cost 10) — for local dev only
      passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
      role: UserRole.ADMIN,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: SEED.userId,
      email: 'alice@headless-dms.dev',
      // bcrypt hash of 'alice123' (cost 10) — for local dev only
      passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      role: UserRole.USER,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]).onConflictDoNothing();
  console.log('  ✓ users');

  // ── Document ───────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: SEED.docId,
    name: 'Q1 Financial Report',
    description: 'Quarterly financial report for Q1 2026',
    isArchived: false,
    ownerId: SEED.adminId,
    createdAt: NOW,
    updatedAt: NOW,
  }).onConflictDoNothing();
  console.log('  ✓ documents');

  // ── Document Version ───────────────────────────────────────────────────────
  await db.insert(documentVersions).values({
    id: SEED.versionId,
    documentId: SEED.docId,
    versionNumber: 1,
    storageKey: 'uploads/q1-financial-report-v1.pdf',
    mimeType: 'application/pdf',
    fileSize: 204800,   // 200 KB
    checksum: 'sha256:abc123def456',
    createdBy: SEED.adminId,
    createdAt: NOW,
    updatedAt: NOW,
  }).onConflictDoNothing();
  console.log('  ✓ document_versions');

  // ── Access Policy ──────────────────────────────────────────────────────────
  await db.insert(accessPolicies).values({
    id: SEED.policyId,
    documentId: SEED.docId,
    userId: SEED.userId,
    accessLevel: AccessLevel.READ,
    createdAt: NOW,
    updatedAt: NOW,
  }).onConflictDoNothing();
  console.log('  ✓ access_policies');

  // ── Audit Log ──────────────────────────────────────────────────────────────
  await db.insert(auditLogs).values({
    id: SEED.auditId,
    userId: SEED.adminId,
    action: AuditAction.DOCUMENT_CREATED,
    resourceId: SEED.docId,
    createdAt: NOW,
    updatedAt: NOW,
  }).onConflictDoNothing();
  console.log('  ✓ audit_logs');

  console.log('\nSeed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
