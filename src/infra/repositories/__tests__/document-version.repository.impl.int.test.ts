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

  async function setupDocument() {
    const user = makeUser();
    await userRepository.insert(user);
    const doc = makeDocument({ ownerId: user.id });
    await documentRepository.insert(doc);
    return doc;
  }

  it("should insert and fetch a document version by ID", async () => {
    const doc = await setupDocument();
    const version = makeDocumentVersion({ documentId: doc.id });
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
    const doc = await setupDocument();
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 1 }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 2 }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 3 }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByDocumentId(doc.id.toString(), options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(3);
  });

  it("should fetch latest version by document ID", async () => {
    const doc = await setupDocument();
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 1 }));
    await repository.insert(makeDocumentVersion({ documentId: doc.id, versionNumber: 2 }));
    const latestVersion = makeDocumentVersion({ documentId: doc.id, versionNumber: 3 });
    await repository.insert(latestVersion);

    const fetchResult = await repository.fetchLatestByDocumentId(doc.id.toString());
    expect(fetchResult.isOk()).toBe(true);
    const maybeVersion = fetchResult.unwrap();
    expect(maybeVersion.isSome()).toBe(true);
    const fetchedVersion = maybeVersion.unwrap();
    expect(fetchedVersion.versionNumber).toBe(3);
  });

  it("should delete a version", async () => {
    const doc = await setupDocument();
    const version = makeDocumentVersion({ documentId: doc.id });
    await repository.insert(version);

    const deleteResult = await repository.delete(version.id.toString());
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap().unwrap().id.toString()).toBe(version.id.toString());

    const fetchResult = await repository.fetchById(version.id.toString());
    expect(fetchResult.unwrap().isNone()).toBe(true);
  });
});
