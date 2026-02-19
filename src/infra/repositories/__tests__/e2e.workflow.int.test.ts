import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { DocumentRepositoryImpl } from "../document.repository.impl";
import { DocumentVersionRepositoryImpl } from "../document-version.repository.impl";
import { UserRepositoryImpl } from "../user.repository.impl";
import { makeDocument, makeDocumentVersion, makeUser } from "@domain/__tests__/factories";
import { PaginationOptions } from "@domain/shared/pagination";
import { DocumentStatus } from "@domain/document/document.enums";
import { sql } from "drizzle-orm";

/**
 * E2E Workflow Test: Create Document → Add Version → Fetch Latest → Update → List
 * 
 * This test validates the complete document lifecycle workflow,
 * ensuring all repositories work together correctly.
 */
describe("E2E Document Workflow", () => {
  let testDb: TestDbContainer;
  let documentRepository: DocumentRepositoryImpl;
  let documentVersionRepository: DocumentVersionRepositoryImpl;
  let userRepository: UserRepositoryImpl;

  beforeAll(async () => {
    testDb = new TestDbContainer();
    const result = await testDb.start();
    documentRepository = new DocumentRepositoryImpl(result.db);
    documentVersionRepository = new DocumentVersionRepositoryImpl(result.db);
    userRepository = new UserRepositoryImpl(result.db);
  }, 120000);

  afterAll(async () => {
    if (testDb) await testDb.stop();
  });

  beforeEach(async () => {
    await testDb.db.execute(sql`TRUNCATE TABLE document_versions, documents, users CASCADE`);
  });

  it("should complete full document lifecycle: create → add version → fetch latest → update → list", async () => {
    // Step 1: Create a user (owner)
    const owner = makeUser();
    const userInsertResult = await userRepository.insert(owner);
    expect(userInsertResult.isOk()).toBe(true);

    // Step 2: Create a document
    const document = makeDocument({
      ownerId: owner.id,
      name: "Q4 Financial Report",
      slug: "q4-financial-report",
      status: DocumentStatus.Active,
      latestVersionId: null, // No version yet
    });

    const docInsertResult = await documentRepository.insert(document);
    expect(docInsertResult.isOk()).toBe(true);
    console.log("✓ Document created:", document.id.toString());

    // Verify document was created
    const fetchedDoc = (await documentRepository.fetchById(document.id.toString())).unwrap().unwrap();
    expect(fetchedDoc.name).toBe("Q4 Financial Report");
    expect(fetchedDoc.latestVersionId).toBeNull();

    // Step 3: Add first version
    const version1 = makeDocumentVersion({
      documentId: document.id,
      versionNumber: 1,
      storageKey: "s3://bucket/documents/q4-report-v1.pdf",
      sizeBytes: 1024000,
      uploadedBy: owner.id,
    });

    const version1InsertResult = await documentVersionRepository.insert(version1);
    expect(version1InsertResult.isOk()).toBe(true);
    console.log("✓ Version 1 added:", version1.id.toString());

    // Update document's latest version
    const updateLatestResult = await documentRepository.updateLatestVersion(
      document.id.toString(),
      version1.id.toString()
    );
    expect(updateLatestResult.isOk()).toBe(true);

    // Step 4: Add second version
    const version2 = makeDocumentVersion({
      documentId: document.id,
      versionNumber: 2,
      storageKey: "s3://bucket/documents/q4-report-v2.pdf",
      sizeBytes: 1150000,
      uploadedBy: owner.id,
    });

    const version2InsertResult = await documentVersionRepository.insert(version2);
    expect(version2InsertResult.isOk()).toBe(true);
    console.log("✓ Version 2 added:", version2.id.toString());

    // Update document's latest version again
    const updateLatestResult2 = await documentRepository.updateLatestVersion(
      document.id.toString(),
      version2.id.toString()
    );
    expect(updateLatestResult2.isOk()).toBe(true);

    // Step 5: Fetch latest version
    const latestVersionResult = await documentVersionRepository.fetchLatestByDocumentId(document.id.toString());
    expect(latestVersionResult.isOk()).toBe(true);
    const maybeLatest = latestVersionResult.unwrap();
    expect(maybeLatest.isSome()).toBe(true);
    const latestVersion = maybeLatest.unwrap();
    expect(latestVersion.versionNumber).toBe(2);
    expect(latestVersion.id.toString()).toBe(version2.id.toString());
    console.log("✓ Latest version fetched:", latestVersion.versionNumber);

    // Verify document's latestVersionId is updated
    const updatedDoc = (await documentRepository.fetchById(document.id.toString())).unwrap().unwrap();
    expect(updatedDoc.latestVersionId?.toString()).toBe(version2.id.toString());

    // Step 6: Update document metadata
    const updatedDocument = makeDocument({
      id: document.id,
      ownerId: document.ownerId,
      name: "Q4 Financial Report (Final)",
      slug: document.slug,
      mimeType: document.mimeType,
      status: document.status,
      latestVersionId: version2.id,
      metadata: { department: "finance", quarter: "Q4", year: 2024 },
    });

    const docUpdateResult = await documentRepository.update(updatedDocument);
    expect(docUpdateResult.isOk()).toBe(true);
    console.log("✓ Document updated with metadata");

    // Verify update
    const finalDoc = (await documentRepository.fetchById(document.id.toString())).unwrap().unwrap();
    expect(finalDoc.name).toBe("Q4 Financial Report (Final)");
    expect(finalDoc.metadata).toEqual({ department: "finance", quarter: "Q4", year: 2024 });

    // Step 7: List all versions with pagination
    const paginationOptions = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const versionsResult = await documentVersionRepository.fetchByDocumentId(
      document.id.toString(),
      paginationOptions
    );
    expect(versionsResult.isOk()).toBe(true);
    const paginatedVersions = versionsResult.unwrap();
    expect(paginatedVersions.data.length).toBe(2);
    expect(paginatedVersions.totalPages).toBe(1);
    console.log("✓ Versions listed:", paginatedVersions.data.length, "versions");

    // Step 8: Fetch document with versions
    const docWithVersionsResult = await documentRepository.fetchWithVersions(document.id.toString());
    expect(docWithVersionsResult.isOk()).toBe(true);
    const maybeDocWithVersions = docWithVersionsResult.unwrap();
    expect(maybeDocWithVersions.isSome()).toBe(true);
    const { document: docResult, versions } = maybeDocWithVersions.unwrap();
    expect(docResult.id.toString()).toBe(document.id.toString());
    expect(versions.length).toBe(2);
    console.log("✓ Document with versions fetched");

    // Step 9: Verify version count
    const versionCountResult = await documentVersionRepository.countByDocumentId(document.id.toString());
    expect(versionCountResult.isOk()).toBe(true);
    expect(versionCountResult.unwrap()).toBe(2);
    console.log("✓ Version count verified");

    // Step 10: Archive the document
    const archiveResult = await documentRepository.archive(document.id.toString());
    expect(archiveResult.isOk()).toBe(true);
    const archivedDoc = archiveResult.unwrap().unwrap();
    expect(archivedDoc.status).toBe(DocumentStatus.Archived);
    console.log("✓ Document archived");

    console.log("\n✅ E2E Workflow completed successfully!");
  });

  it("should support searching documents by metadata", async () => {
    const owner = makeUser();
    await userRepository.insert(owner);

    // Create documents with metadata
    const doc1 = makeDocument({
      ownerId: owner.id,
      name: "Doc 1",
      slug: "doc-1",
      metadata: { department: "finance", priority: "high" },
    });
    const doc2 = makeDocument({
      ownerId: owner.id,
      name: "Doc 2",
      slug: "doc-2",
      metadata: { department: "engineering", priority: "high" },
    });
    const doc3 = makeDocument({
      ownerId: owner.id,
      name: "Doc 3",
      slug: "doc-3",
      metadata: { department: "finance", priority: "low" },
    });

    await documentRepository.insert(doc1);
    await documentRepository.insert(doc2);
    await documentRepository.insert(doc3);

    // Search by metadata
    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const searchResult = await documentRepository.searchByMetadata("department", "finance", options);

    expect(searchResult.isOk()).toBe(true);
    const results = searchResult.unwrap();
    expect(results.data.length).toBe(2);
    expect(results.data.every((d) => (d.metadata as Record<string, unknown> | null)?.department === "finance")).toBe(true);
  });
});
