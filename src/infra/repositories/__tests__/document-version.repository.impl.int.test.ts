import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { DocumentVersionRepositoryImpl } from "../document-version.repository.impl";
import { DocumentRepositoryImpl } from "../document.repository.impl";
import { UserRepositoryImpl } from "../user.repository.impl";
import { makeDocumentVersion, makeDocument, makeUser, TEST_IDS } from "@domain/__tests__/factories";
import { PaginationOptions } from "@domain/shared/pagination";
import { sql } from "drizzle-orm";

describe("DocumentVersionRepositoryImpl Integration Tests", () => {
  let testDb: TestDbContainer;
  let repository: DocumentVersionRepositoryImpl;
  let documentRepository: DocumentRepositoryImpl;
  let userRepository: UserRepositoryImpl;

  beforeAll(async () => {
    testDb = new TestDbContainer();
    const result = await testDb.start();
    repository = new DocumentVersionRepositoryImpl(result.db);
    documentRepository = new DocumentRepositoryImpl(result.db);
    userRepository = new UserRepositoryImpl(result.db);
  }, 120000);

  afterAll(async () => {
    if (testDb) await testDb.stop();
  });

  beforeEach(async () => {
    await testDb.db.execute(sql`TRUNCATE TABLE document_versions, documents, users CASCADE`);
  });

  async function setupDocumentWithOwnerAndUploader() {
    const user = makeUser();
    await userRepository.insert(user);

    const doc = makeDocument({ ownerId: user.id });
    await documentRepository.insert(doc);

    return { doc, user };
  }

  it("should insert and fetch a document version by ID", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    const version = makeDocumentVersion({ documentId: doc.id, uploadedBy: user.id });
    const insertResult = await repository.insert(version);
    expect(insertResult.isOk()).toBe(true);

    const fetchResult = await repository.fetchById(version.id.toString());
    expect(fetchResult.isOk()).toBe(true);
    const maybeVersion = fetchResult.unwrap();
    expect(maybeVersion.isSome()).toBe(true);
    const fetchedVersion = maybeVersion.unwrap();
    expect(fetchedVersion.id.toString()).toBe(version.id.toString());
    expect(fetchedVersion.documentId.toString()).toBe(doc.id.toString());
  });

  it("should fetch versions by document ID with pagination", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    // Insert 15 versions for the document
    for (let i = 1; i <= 15; i++) {
      await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: i, uploadedBy: user.id }));
    }

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByDocumentId(doc.id.toString(), options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(10);
    expect(paginated.totalPages).toBe(2);
  });

  it("should fetch version by version number", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    const version = makeDocumentVersion({ documentId: doc.id, versionNumber: 5, uploadedBy: user.id });
    await repository.insert(version);

    const fetchResult = await repository.fetchByVersionNumber(doc.id.toString(), 5);
    expect(fetchResult.isOk()).toBe(true);
    const maybeVersion = fetchResult.unwrap();
    expect(maybeVersion.isSome()).toBe(true);
    expect(maybeVersion.unwrap().versionNumber).toBe(5);
  });

  it("should fetch latest version by document ID", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    // Insert versions with different version numbers
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 1, uploadedBy: user.id }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 3, uploadedBy: user.id }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 2, uploadedBy: user.id }));

    const fetchResult = await repository.fetchLatestByDocumentId(doc.id.toString());
    expect(fetchResult.isOk()).toBe(true);
    const maybeVersion = fetchResult.unwrap();
    expect(maybeVersion.isSome()).toBe(true);
    expect(maybeVersion.unwrap().versionNumber).toBe(3);
  });

  it("should fetch version by storage key", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    const storageKey = "s3://bucket/path/to/file.pdf";
    const version = makeDocumentVersion({ documentId: doc.id, storageKey, uploadedBy: user.id });
    await repository.insert(version);

    const fetchResult = await repository.fetchByStorageKey(storageKey);
    expect(fetchResult.isOk()).toBe(true);
    const maybeVersion = fetchResult.unwrap();
    expect(maybeVersion.isSome()).toBe(true);
    expect(maybeVersion.unwrap().storageKey.toString()).toBe(storageKey);
  });

  it("should check if storage key exists", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    const storageKey = "s3://bucket/unique-key";
    const version = makeDocumentVersion({ documentId: doc.id, storageKey, uploadedBy: user.id });
    await repository.insert(version);

    const existsResult = await repository.existsByStorageKey(storageKey);
    expect(existsResult.isOk()).toBe(true);
    expect(existsResult.unwrap()).toBe(true);

    const notExistsResult = await repository.existsByStorageKey("non-existent-key");
    expect(notExistsResult.unwrap()).toBe(false);
  });

  it("should fetch versions by checksum", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    const checksum = "abc123def456";
    await repository.insert(makeDocumentVersion({ documentId: doc.id, checksum, uploadedBy: user.id }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, checksum, uploadedBy: user.id }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByChecksum(checksum, options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
  });

  it("should check if checksum exists", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    const checksum = "unique-checksum-123";
    const version = makeDocumentVersion({ documentId: doc.id, checksum, uploadedBy: user.id });
    await repository.insert(version);

    const existsResult = await repository.existsByChecksum(checksum);
    expect(existsResult.isOk()).toBe(true);
    expect(existsResult.unwrap()).toBe(true);
  });

  it("should get next version number for a document", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    // No versions yet
    const nextResult1 = await repository.getNextVersionNumber(doc.id.toString());
    expect(nextResult1.isOk()).toBe(true);
    expect(nextResult1.unwrap()).toBe(1);

    // Add a version
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 1, uploadedBy: user.id }));

    const nextResult2 = await repository.getNextVersionNumber(doc.id.toString());
    expect(nextResult2.isOk()).toBe(true);
    expect(nextResult2.unwrap()).toBe(2);
  });

  it("should count versions by document ID", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 1, uploadedBy: user.id }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 2, uploadedBy: user.id }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 3, uploadedBy: user.id }));

    const countResult = await repository.countByDocumentId(doc.id.toString());
    expect(countResult.isOk()).toBe(true);
    expect(countResult.unwrap()).toBe(3);
  });

  it("should delete a version", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    const version = makeDocumentVersion({ documentId: doc.id, uploadedBy: user.id });
    await repository.insert(version);

    const deleteResult = await repository.delete(version.id.toString());
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap().unwrap().id.toString()).toBe(version.id.toString());

    const fetchResult = await repository.fetchById(version.id.toString());
    expect(fetchResult.unwrap().isNone()).toBe(true);
  });

  it("should delete all versions by document ID", async () => {
    const { doc, user } = await setupDocumentWithOwnerAndUploader();

    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 1, uploadedBy: user.id }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 2, uploadedBy: user.id }));

    const deleteResult = await repository.deleteByDocumentId(doc.id.toString());
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap()).toBe(2);

    const countResult = await repository.countByDocumentId(doc.id.toString());
    expect(countResult.unwrap()).toBe(0);
  });
});
