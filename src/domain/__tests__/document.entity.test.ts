import { describe, it, expect } from 'vitest';
import { Document } from 'src/domain/document/document.entity';
import { DocumentStatus } from 'src/domain/document/document.enums';
import { makeDocument, makeDocumentWithStatus, TEST_IDS } from './factories';
import { TestPatterns } from './utils/test.helpers';

describe('Document entity', () => {
  describe('create()', () => {
    it('creates a document with a generated UUID id', () => {
      const result = Document.create({
        name: 'My Report',
        description: 'Q1 financial report',
        ownerId: TEST_IDS.user1,
        slug: 'my-report',
        mimeType: 'application/pdf' as any,
        status: DocumentStatus.Active,
        latestVersionId: null,
        metadata: null,
      });

      const doc = TestPatterns.Result.expectOk(result);
      expect(doc.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(doc.name).toBe('My Report');
      expect(doc.description).toBe('Q1 financial report');
      expect(doc.ownerId).toBe(TEST_IDS.user1);
      expect(doc.slug).toBe('my-report');
      expect(doc.status).toBe(DocumentStatus.Active);
      expect(doc.latestVersionId).toBeNull();
      expect(doc.metadata).toBeNull();
    });

    it('sets createdAt and updatedAt to the current time', () => {
      const before = new Date();
      const doc = TestPatterns.Result.expectOk(
        Document.create({
          name: 'Doc',
          description: null,
          ownerId: TEST_IDS.user1,
          slug: 'doc',
          mimeType: 'application/pdf' as any,
          status: DocumentStatus.Active,
          latestVersionId: null,
          metadata: null,
        }),
      );
      const after = new Date();

      expect(doc.createdAt.toDate().getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(doc.createdAt.toDate().getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('generates a unique id on each call', () => {
      const makeDoc = (slug: string) => Document.create({
        name: 'A', description: null, ownerId: TEST_IDS.user1,
        slug, mimeType: 'application/pdf' as any,
        status: DocumentStatus.Active, latestVersionId: null, metadata: null,
      });
      const doc1 = TestPatterns.Result.expectOk(makeDoc('slug-a'));
      const doc2 = TestPatterns.Result.expectOk(makeDoc('slug-b'));
      expect(doc1.id).not.toBe(doc2.id);
    });
  });

  describe('fromSerialized()', () => {
    it('rehydrates a document from factory-generated data', () => {
      const doc = makeDocument({
        id: TEST_IDS.doc1,
        name: 'Quarterly Report',
        ownerId: TEST_IDS.user1,
        description: 'Q1 results',
        slug: 'quarterly-report',
        status: DocumentStatus.Active,
      });

      expect(doc.id).toBe(TEST_IDS.doc1);
      expect(doc.name).toBe('Quarterly Report');
      expect(doc.description).toBe('Q1 results');
      expect(doc.ownerId).toBe(TEST_IDS.user1);
      expect(doc.slug).toBe('quarterly-report');
      expect(doc.status).toBe(DocumentStatus.Active);
    });

    it('factory generates realistic timestamps', () => {
      const doc = makeDocument();
      expect(new Date(doc.createdAt.toISOString()).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('makeDocumentWithStatus produces an archived document', () => {
      const doc = makeDocumentWithStatus(DocumentStatus.Archived);
      expect(doc.status).toBe(DocumentStatus.Archived);
    });
  });

  describe('serialize()', () => {
    it('round-trips through serialize → fromSerialized', () => {
      const original = makeDocument({ name: 'Round Trip Doc', metadata: { department: 'finance' } });
      const serialized = original.serialize();
      const restored = Document.fromSerialized(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.description).toBe(original.description);
      expect(restored.ownerId).toBe(original.ownerId);
      expect(restored.slug).toBe(original.slug);
      expect(restored.status).toBe(original.status);
      expect(restored.latestVersionId).toBe(original.latestVersionId);
      expect(restored.metadata).toEqual(original.metadata);
      expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    });

    it('serializes all fields to primitives', () => {
      const doc = makeDocument();
      const serialized = doc.serialize();

      expect(typeof serialized.id).toBe('string');
      expect(typeof serialized.name).toBe('string');
      expect(serialized.description === null || typeof serialized.description === 'string').toBe(true);
      expect(typeof serialized.ownerId).toBe('string');
      expect(typeof serialized.slug).toBe('string');
      expect(typeof serialized.mimeType).toBe('string');
      expect(typeof serialized.status).toBe('string');
      expect(typeof serialized.createdAt).toBe('string');
      expect(typeof serialized.updatedAt).toBe('string');
    });
  });

  describe('equals()', () => {
    it('returns true for documents with the same id', () => {
      const a = makeDocument({ id: TEST_IDS.doc1 });
      const b = makeDocument({ id: TEST_IDS.doc1 });
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for documents with different ids', () => {
      const a = makeDocument({ id: TEST_IDS.doc1 });
      const b = makeDocument({ id: TEST_IDS.doc2 });
      expect(a.equals(b)).toBe(false);
    });
  });
});
