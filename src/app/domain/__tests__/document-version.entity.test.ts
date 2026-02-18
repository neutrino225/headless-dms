import { describe, it, expect } from 'vitest';
import { DocumentVersion } from '@domain/document/document-version.entity';
import { makeDocumentVersion, TEST_IDS } from './factories';
import { TestPatterns } from './utils/test.helpers';

describe('DocumentVersion entity', () => {
  describe('create()', () => {
    it('creates a version with a generated id', () => {
      const result = DocumentVersion.create({
        documentId: TEST_IDS.doc1,
        versionNumber: 1,
        storageKey: 'uploads/file.pdf' as any,
        mimeType: 'application/pdf' as any,
        fileSize: 1024,
        checksum: 'b'.repeat(64) as any,
        createdBy: TEST_IDS.user1,
      });

      const version = TestPatterns.Result.expectOk(result);
      expect(version.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(version.versionNumber).toBe(1);
      expect(version.fileSize).toBe(1024);
    });

    it('sets createdAt and updatedAt to the same time (immutable)', () => {
      const version = TestPatterns.Result.expectOk(
        DocumentVersion.create({
          documentId: TEST_IDS.doc1,
          versionNumber: 1,
          storageKey: 'uploads/file.pdf' as any,
          mimeType: 'application/pdf' as any,
          fileSize: 512,
          checksum: 'c'.repeat(64) as any,
          createdBy: TEST_IDS.user1,
        }),
      );

      expect(version.createdAt.toISOString()).toBe(version.updatedAt.toISOString());
    });
  });

  describe('fromSerialized()', () => {
    it('rehydrates a version from factory-generated data', () => {
      const version = makeDocumentVersion({
        id: TEST_IDS.docVersion1,
        documentId: TEST_IDS.doc1,
        versionNumber: 3,
        fileSize: 204800,
        createdBy: TEST_IDS.user1,
      });

      expect(version.id).toBe(TEST_IDS.docVersion1);
      expect(version.documentId).toBe(TEST_IDS.doc1);
      expect(version.versionNumber).toBe(3);
      expect(version.fileSize).toBe(204800);
      expect(version.createdBy).toBe(TEST_IDS.user1);
    });

    it('factory generates realistic mime types and storage keys', () => {
      const version = makeDocumentVersion();
      expect(version.mimeType).toBeTruthy();
      expect(version.storageKey).toMatch(/^uploads\//);
    });
  });

  describe('serialize()', () => {
    it('round-trips through serialize → fromSerialized', () => {
      const original = makeDocumentVersion({ versionNumber: 2 });
      const serialized = original.serialize();
      const restored = DocumentVersion.fromSerialized(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.documentId).toBe(original.documentId);
      expect(restored.versionNumber).toBe(original.versionNumber);
      expect(restored.fileSize).toBe(original.fileSize);
      expect(restored.checksum).toBe(original.checksum);
    });

    it('serializes fileSize as a number', () => {
      const version = makeDocumentVersion({ fileSize: 99999 });
      const serialized = version.serialize();
      expect(typeof serialized.fileSize).toBe('number');
      expect(serialized.fileSize).toBe(99999);
    });
  });
});
