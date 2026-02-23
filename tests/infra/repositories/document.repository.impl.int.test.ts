import "reflect-metadata";
import { DocumentRepositoryImpl } from "@infra/repositories/document.repository.impl";
import { UserRepositoryImpl } from "@infra/repositories/user.repository.impl";
import { makeDocument, makeUser, type TEST_IDS } from "@tests/domain/factories";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TestDbContainer } from "../utils/test-db";

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
		const doc = makeDocument({ ownerId: user.id, name: "Original" });
		await repository.insert(doc);

		const updatedDoc = makeDocument({
			id: doc.id,
			ownerId: user.id,
			name: "Updated",
		});
		const updateResult = await repository.update(updatedDoc);
		expect(updateResult.isOk()).toBe(true);

		const fetchResult = await repository.fetchById(doc.id.toString());
		const fetchedDoc = fetchResult.unwrap().unwrap();
		expect(fetchedDoc.name).toBe("Updated");
	});

	it("should fetch a document by slug", async () => {
		const user = await setupUser();
		const doc = makeDocument({ ownerId: user.id, slug: "unique-slug" });
		await repository.insert(doc);

		const fetchResult = await repository.fetchBySlug("unique-slug");
		expect(fetchResult.isOk()).toBe(true);
		const maybeDoc = fetchResult.unwrap();
		expect(maybeDoc.isSome()).toBe(true);
		expect(maybeDoc.unwrap().id.toString()).toBe(doc.id.toString());
	});

	it("should delete a document", async () => {
		const user = await setupUser();
		const doc = makeDocument({ ownerId: user.id });
		await repository.insert(doc);

		const deleteResult = await repository.delete(doc.id.toString());
		expect(deleteResult.isOk()).toBe(true);
		expect(deleteResult.unwrap().unwrap().id.toString()).toBe(
			doc.id.toString(),
		);

		const fetchResult = await repository.fetchById(doc.id.toString());
		expect(fetchResult.unwrap().isNone()).toBe(true);
	});
});
