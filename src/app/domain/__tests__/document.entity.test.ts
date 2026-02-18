import { describe, it, expect } from 'vitest';
import { Document } from '@domain/document/document.entity';
import { makeDocument, makeArchivedDocument, TEST_IDS } from './factories';
import { TestPatterns } from './utils/test.helpers';

describe('Document entity', () => {
  describe('create()', () => {
    it('creates a document with a generated UUID id', () => {
      const result = Document.create({
        name: 'My Report',
        description: 'Q1 financial report',
        ownerId: TEST_IDS.user1,
        isArchived: false,
      });

      const doc = TestPatterns.Result.expectOk(result);
      expect(doc.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(doc.name).toBe('My Report');
      expect(doc.description).toBe('Q1 financial report');
      expect(doc.ownerId).toBe(TEST_IDS.user1);
      expect(doc.isArchived).toBe(false);
    });

    it('sets createdAt and updatedAt to the current time', () => {
      const before = new Date();
      const doc = TestPatterns.Result.expectOk(
        Document.create({ name: 'Doc', description: null, ownerId: TEST_IDS.user1, isArchived: false }),
      );
      const after = new Date();

      expect(doc.createdAt.toDate().getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(doc.createdAt.toDate().getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('generates a unique id on each call', () => {
      const doc1 = TestPatterns.Result.expectOk(
        Document.create({ name: 'A', description: null, ownerId: TEST_IDS.user1, isArchived: false }),
      );
      const doc2 = TestPatterns.Result.expectOk(
        Document.create({ name: 'B', description: null, ownerId: TEST_IDS.user1, isArchived: false }),
      );
      expect(doc1.id).not.toBe(doc2.id);
    });
  });

  describe('fromSerialized()', () => {
    it('rehydrates a document from factory-generated data', () => {
      const doc = makeDocument({ id: TEST_IDS.doc1, name: 'Quarterly Report', ownerId: TEST_IDS.user1, description: 'Q1 results' });

      expect(doc.id).toBe(TEST_IDS.doc1);
      expect(doc.name).toBe('Quarterly Report');
      expect(doc.description).toBe('Q1 results');
      expect(doc.ownerId).toBe(TEST_IDS.user1);
      expect(doc.isArchived).toBe(false);
    });

    it('factory generates realistic timestamps', () => {
      const doc = makeDocument();
      // createdAt should be a valid ISO date in the past
      expect(new Date(doc.createdAt.toISOString()).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('serialize()', () => {
    it('round-trips through serialize → fromSerialized', () => {
      const original = makeDocument({ name: 'Round Trip Doc' });
      const serialized = original.serialize();
      const restored = Document.fromSerialized(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.description).toBe(original.description);
      expect(restored.ownerId).toBe(original.ownerId);
      expect(restored.isArchived).toBe(original.isArchived);
      expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    });

    it('serializes all fields to primitives', () => {
      const doc = makeDocument();
      const serialized = doc.serialize();

      expect(typeof serialized.id).toBe('string');
      expect(typeof serialized.name).toBe('string');
      expect(serialized.description === null || typeof serialized.description === 'string').toBe(true);
      expect(typeof serialized.ownerId).toBe('string');
      expect(typeof serialized.isArchived).toBe('boolean');
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
