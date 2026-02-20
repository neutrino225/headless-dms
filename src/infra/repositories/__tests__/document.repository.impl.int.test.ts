import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { DocumentRepositoryImpl } from "../document.repository.impl";
import { UserRepositoryImpl } from "../user.repository.impl";
import { makeDocument, makeUser, TEST_IDS } from "@domain/__tests__/factories";
import { PaginationOptions } from "@domain/shared/pagination";
import { DocumentStatus } from "@domain/document/document.enums";
import { sql } from "drizzle-orm";

describe("DocumentRepositoryImpl Integration Tests", () => {
  let testDb: TestDbContainer;
  let repository: DocumentRepositoryImpl;
  let userRepository: UserRepositoryImpl;

  beforeAll(async () => {
    testDb = new TestDbContainer();
    const result = await testDb.start();
    repository = new DocumentRepositoryImpl(result.db);
    userRepository = new UserRepositoryImpl(result.db);
  }, 120000);

  afterAll(async () => {
    if (testDb) await testDb.stop();
  });

  beforeEach(async () => {
    await testDb.db.execute(sql`TRUNCATE TABLE documents, users CASCADE`);
  });

  async function setupUser(userId?: typeof TEST_IDS.user1) {
    const user = userId ? makeUser({ id: userId }) : makeUser();
    await userRepository.insert(user);
    return user;
  }

  it("should insert and fetch a document by ID", async () => {
    const user = await setupUser();
    const doc = makeDocument({ ownerId: user.id });
    const insertResult = await repository.insert(doc);
    expect(insertResult.isOk()).toBe(true);

    const fetchResult = await repository.fetchById(doc.id.toString());
    expect(fetchResult.isOk()).toBe(true);
    const maybeDoc = fetchResult.unwrap();
    expect(maybeDoc.isSome()).toBe(true);
    const fetchedDoc = maybeDoc.unwrap();
    expect(fetchedDoc.id.toString()).toBe(doc.id.toString());
    expect(fetchedDoc.name).toBe(doc.name);
  });

  it("should update a document and rehydrate correctly", async () => {
    const user = await setupUser();
    const doc = makeDocument({ name: "Original Name", ownerId: user.id });
    await repository.insert(doc);

    const updatedDoc = makeDocument({
      id: doc.id,
      name: "Updated Name",
      ownerId: doc.ownerId,
      slug: doc.slug,
      mimeType: doc.mimeType.toString() as any,
    });

    const updateResult = await repository.update(updatedDoc);
    expect(updateResult.isOk()).toBe(true);

    const fetchResult = await repository.fetchById(doc.id.toString());
    const fetchedDoc = fetchResult.unwrap().unwrap();
    expect(fetchedDoc.name).toBe("Updated Name");
  });

  it("should fetch documents by owner ID with pagination", async () => {
    const ownerId = TEST_IDS.user1;
    await setupUser(ownerId);
    
    // Insert 15 documents for the owner
    for (let i = 0; i < 15; i++) {
      await repository.insert(makeDocument({ ownerId }));
    }

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByOwnerId(ownerId.toString(), options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(10);
    expect(paginated.totalPages).toBe(2);
  });

  it("should fetch documents by status", async () => {
    const user = await setupUser();
    // Insert 10 active documents
    for (let i = 0; i < 10; i++) {
      await repository.insert(makeDocument({ status: DocumentStatus.Active, ownerId: user.id }));
    }
    // Insert 5 archived documents
    for (let i = 0; i < 5; i++) {
      await repository.insert(makeDocument({ status: DocumentStatus.Archived, ownerId: user.id }));
    }

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByStatus(DocumentStatus.Active, options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(10);
    expect(paginated.data.every(d => d.status === DocumentStatus.Active)).toBe(true);
  });

  it("should check if slug exists", async () => {
    const slug = "unique-slug-123";
    const user = await setupUser();
    const doc = makeDocument({ slug, ownerId: user.id });
    await repository.insert(doc);

    const existsResult = await repository.existsBySlug(slug);
    expect(existsResult.isOk()).toBe(true);
    expect(existsResult.unwrap()).toBe(true);

    const notExistsResult = await repository.existsBySlug("non-existent-slug");
    expect(notExistsResult.unwrap()).toBe(false);
  });

  it("should search documents by name", async () => {
    const user = await setupUser();
    const doc1 = makeDocument({ name: "financial-report-2024", ownerId: user.id });
    const doc2 = makeDocument({ name: "project-proposal", ownerId: user.id });
    await repository.insert(doc1);
    await repository.insert(doc2);

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.searchByName("financial", options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(1);
    expect(paginated.data[0].name).toBe("financial-report-2024");
  });

  it("should archive and restore a document", async () => {
    const user = await setupUser();
    const doc = makeDocument({ status: DocumentStatus.Active, ownerId: user.id });
    await repository.insert(doc);

    const archiveResult = await repository.archive(doc.id.toString());
    expect(archiveResult.isOk()).toBe(true);
    expect(archiveResult.unwrap().unwrap().status).toBe(DocumentStatus.Archived);

    const restoreResult = await repository.restore(doc.id.toString());
    expect(restoreResult.isOk()).toBe(true);
    expect(restoreResult.unwrap().unwrap().status).toBe(DocumentStatus.Active);
  });

  it("should soft delete a document", async () => {
    const user = await setupUser();
    const doc = makeDocument({ ownerId: user.id });
    await repository.insert(doc);

    const deleteResult = await repository.softDelete(doc.id.toString());
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap().unwrap().status).toBe(DocumentStatus.Deleted);
  });

  it("should fetch document with versions", async () => {
    const user = await setupUser();
    const doc = makeDocument({ ownerId: user.id });
    await repository.insert(doc);

    const result = await repository.fetchWithVersions(doc.id.toString());
    expect(result.isOk()).toBe(true);
    const maybeResult = result.unwrap();
    expect(maybeResult.isSome()).toBe(true);
    const { document, versions } = maybeResult.unwrap();
    expect(document.id.toString()).toBe(doc.id.toString());
    expect(Array.isArray(versions)).toBe(true);
  });

  it("should update latest version ID", async () => {
    const user = await setupUser();
    const doc = makeDocument({ latestVersionId: null, ownerId: user.id });
    await repository.insert(doc);

    const versionId = TEST_IDS.docVersion1;
    const updateResult = await repository.updateLatestVersion(
      doc.id.toString(),
      versionId.toString()
    );

    expect(updateResult.isOk()).toBe(true);
    expect(updateResult.unwrap().unwrap().latestVersionId?.toString()).toBe(versionId.toString());
  });

  it("should delete a document", async () => {
    const user = await setupUser();
    const doc = makeDocument({ ownerId: user.id });
    await repository.insert(doc);

    const deleteResult = await repository.delete(doc.id.toString());
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap().unwrap().id.toString()).toBe(doc.id.toString());

    const fetchResult = await repository.fetchById(doc.id.toString());
    expect(fetchResult.unwrap().isNone()).toBe(true);
  });
});
