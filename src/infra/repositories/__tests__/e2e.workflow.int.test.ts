import "reflect-metadata";
import {
	makeDocument,
	makeDocumentVersion,
	makeUser,
} from "@domain/__tests__/factories";
import { Document } from "@domain/document/document.entity";
import { DocumentStatus } from "@domain/document/document.enums";
import { PaginationOptions } from "@domain/shared/pagination";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { DocumentRepositoryImpl } from "../document.repository.impl";
import { UserRepositoryImpl } from "../user.repository.impl";

/**
 * E2E Workflow Test: Simplified document lifecycle using minimal repository methods
 */
describe("E2E Document Workflow", () => {
	let testDb: TestDbContainer;
	let documentRepository: DocumentRepositoryImpl;
	let userRepository: UserRepositoryImpl;

	beforeAll(async () => {
		testDb = new TestDbContainer();
		const result = await testDb.start();
		documentRepository = new DocumentRepositoryImpl(result.db);
		userRepository = new UserRepositoryImpl(result.db);
	}, 120000);

	afterAll(async () => {
		if (testDb) await testDb.stop();
	});

	beforeEach(async () => {
		await testDb.db.execute(
			sql`TRUNCATE TABLE document_versions, documents, users CASCADE`,
		);
	});

	it("should complete full document lifecycle: create → add versions → fetch latest → update", async () => {
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
			latestVersionId: null,
		});

		const docInsertResult = await documentRepository.insert(document);
		expect(docInsertResult.isOk()).toBe(true);

		// Verify document was created
		const fetchedDoc = (
			await documentRepository.fetchById(document.id.toString())
		)
			.unwrap()
			.unwrap();
		expect(fetchedDoc.name).toBe("Q4 Financial Report");
		expect(fetchedDoc.latestVersionId.isNone()).toBe(true);

		// Step 3: Add first version
		const version1 = makeDocumentVersion({
			documentId: document.id,
			versionNumber: 1,
			storageKey: "s3://bucket/documents/q4-report-v1.pdf",
			sizeBytes: 1024000,
			uploadedBy: owner.id,
		});

		fetchedDoc.addVersion(version1);
		const version1InsertResult = await documentRepository.update(fetchedDoc);
		expect(version1InsertResult.isOk()).toBe(true);

		// Step 4: Add second version
		const version2 = makeDocumentVersion({
			documentId: document.id,
			versionNumber: 2,
			storageKey: "s3://bucket/documents/q4-report-v2.pdf",
			sizeBytes: 1150000,
			uploadedBy: owner.id,
		});

		fetchedDoc.addVersion(version2);
		const version2InsertResult = await documentRepository.update(fetchedDoc);
		expect(version2InsertResult.isOk()).toBe(true);

		// Step 5: Fetch latest version
		const latestVersionResult =
			await documentRepository.fetchLatestVersionByDocumentId(
				document.id.toString(),
			);
		expect(latestVersionResult.isOk()).toBe(true);
		const maybeLatest = latestVersionResult.unwrap();
		expect(maybeLatest.isSome()).toBe(true);
		const latestVersion = maybeLatest.unwrap();
		expect(latestVersion.versionNumber).toBe(2);
		expect(latestVersion.id.toString()).toBe(version2.id.toString());

		// Step 6: Update document metadata
		// fetchedDoc already has latestVersionId updated via addVersion
		// we can add extra metadata
		const updatedDocument = Document.fromSerialized({
			...fetchedDoc.serialize(),
			name: "Q4 Financial Report (Final)",
			metadata: { department: "finance", quarter: "Q4", year: 2024 },
		});

		const docUpdateResult = await documentRepository.update(updatedDocument);
		expect(docUpdateResult.isOk()).toBe(true);

		// Verify update
		const finalDoc = (
			await documentRepository.fetchById(document.id.toString())
		)
			.unwrap()
			.unwrap();
		expect(finalDoc.name).toBe("Q4 Financial Report (Final)");
		expect(finalDoc.metadata?.safeUnwrap()).toEqual({
			department: "finance",
			quarter: "Q4",
			year: 2024,
		});

		// Step 7: List all versions with pagination
		const paginationOptions = PaginationOptions.create({
			pageNum: 1,
			pageSize: 10,
		}).unwrap();
		const versionsResult = await documentRepository.fetchVersionsByDocumentId(
			document.id.toString(),
			paginationOptions,
		);
		expect(versionsResult.isOk()).toBe(true);
		const paginatedVersions = versionsResult.unwrap();
		expect(paginatedVersions.data.length).toBe(2);
		expect(paginatedVersions.totalPages).toBe(1);

		// Step 8: Fetch document by slug
		const slugResult = await documentRepository.fetchBySlug(
			"q4-financial-report",
		);
		expect(slugResult.isOk()).toBe(true);
		expect(slugResult.unwrap().unwrap().id.toString()).toBe(
			document.id.toString(),
		);
	});

	it("should support fetching user by email", async () => {
		const user1 = makeUser({ email: "alice@example.com" });
		const user2 = makeUser({ email: "bob@example.com" });

		await userRepository.insert(user1);
		await userRepository.insert(user2);

		const fetchResult = await userRepository.fetchByEmail("alice@example.com");
		expect(fetchResult.isOk()).toBe(true);
		const maybeUser = fetchResult.unwrap();
		expect(maybeUser.isSome()).toBe(true);
		expect(maybeUser.unwrap().id.toString()).toBe(user1.id.toString());
	});
});
