import { describe, it, expect } from 'vitest';
import { DocumentVersion } from 'src/domain/document/document-version.entity';
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
        sizeBytes: 1024,
        checksum: 'b'.repeat(64) as any,
        uploadedBy: TEST_IDS.user1,
      });

      const version = TestPatterns.Result.expectOk(result);
      expect(version.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(version.versionNumber).toBe(1);
      expect(version.sizeBytes).toBe(1024);
      expect(version.uploadedBy).toBe(TEST_IDS.user1);
    });

    it('sets createdAt and updatedAt to the same time (immutable)', () => {
      const version = TestPatterns.Result.expectOk(
        DocumentVersion.create({
          documentId: TEST_IDS.doc1,
          versionNumber: 1,
          storageKey: 'uploads/file.pdf' as any,
          mimeType: 'application/pdf' as any,
          sizeBytes: 512,
          checksum: 'c'.repeat(64) as any,
          uploadedBy: TEST_IDS.user1,
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
        sizeBytes: 204800,
        uploadedBy: TEST_IDS.user1,
      });

      expect(version.id).toBe(TEST_IDS.docVersion1);
      expect(version.documentId).toBe(TEST_IDS.doc1);
      expect(version.versionNumber).toBe(3);
      expect(version.sizeBytes).toBe(204800);
      expect(version.uploadedBy).toBe(TEST_IDS.user1);
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
      expect(restored.sizeBytes).toBe(original.sizeBytes);
      expect(restored.checksum).toBe(original.checksum);
      expect(restored.uploadedBy).toBe(original.uploadedBy);
    });

    it('serializes sizeBytes as a number', () => {
      const version = makeDocumentVersion({ sizeBytes: 99999 });
      const serialized = version.serialize();
      expect(typeof serialized.sizeBytes).toBe('number');
      expect(serialized.sizeBytes).toBe(99999);
    });
  });
});
