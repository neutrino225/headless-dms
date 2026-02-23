import "reflect-metadata";
import {
	makeAccessPolicy,
	makeDocument,
	makeUser,
} from "@domain/__tests__/factories";
import { AccessLevel } from "@domain/document/document.enums";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { AccessPolicyRepositoryImpl } from "../access-policy.repository.impl";
import { DocumentRepositoryImpl } from "../document.repository.impl";
import { UserRepositoryImpl } from "../user.repository.impl";

describe("AccessPolicyRepositoryImpl Integration Tests", () => {
	let testDb: TestDbContainer;
	let repository: AccessPolicyRepositoryImpl;
	let documentRepository: DocumentRepositoryImpl;
	let userRepository: UserRepositoryImpl;

	beforeAll(async () => {
		testDb = new TestDbContainer();
		const result = await testDb.start();
		repository = new AccessPolicyRepositoryImpl(result.db);
		documentRepository = new DocumentRepositoryImpl(result.db);
		userRepository = new UserRepositoryImpl(result.db);
	}, 120000);

	afterAll(async () => {
		if (testDb) await testDb.stop();
	});

	beforeEach(async () => {
		await testDb.db.execute(
			sql`TRUNCATE TABLE access_policies, documents, users CASCADE`,
		);
	});

	async function setupDocumentAndUser() {
		const user = makeUser();
		await userRepository.insert(user);

		const doc = makeDocument({ ownerId: user.id });
		await documentRepository.insert(doc);
		return { user, doc };
	}

	it("should insert and fetch an access policy by ID", async () => {
		const { user, doc } = await setupDocumentAndUser();

		const policy = makeAccessPolicy({ documentId: doc.id, userId: user.id });
		const insertResult = await repository.insert(policy);
		expect(insertResult.isOk()).toBe(true);

		const fetchResult = await repository.fetchById(policy.id.toString());
		expect(fetchResult.isOk()).toBe(true);
		const maybePolicy = fetchResult.unwrap();
		expect(maybePolicy.isSome()).toBe(true);
		const fetchedPolicy = maybePolicy.unwrap();
		expect(fetchedPolicy.id.toString()).toBe(policy.id.toString());
		expect(fetchedPolicy.documentId.toString()).toBe(doc.id.toString());
		expect(fetchedPolicy.userId.toString()).toBe(user.id.toString());
	});

	it("should fetch policy by document and user", async () => {
		const { user, doc } = await setupDocumentAndUser();

		const policy = makeAccessPolicy({ documentId: doc.id, userId: user.id });
		await repository.insert(policy);

		const fetchResult = await repository.fetchByDocumentAndUser(
			doc.id.toString(),
			user.id.toString(),
		);

		expect(fetchResult.isOk()).toBe(true);
		const maybePolicy = fetchResult.unwrap();
		expect(maybePolicy.isSome()).toBe(true);
		expect(maybePolicy.unwrap().id.toString()).toBe(policy.id.toString());
	});

	it("should update an access policy", async () => {
		const { user, doc } = await setupDocumentAndUser();

		const policy = makeAccessPolicy({
			documentId: doc.id,
			userId: user.id,
			accessLevel: AccessLevel.READ,
		});
		await repository.insert(policy);

		const updatedPolicy = makeAccessPolicy({
			id: policy.id,
			documentId: doc.id,
			userId: user.id,
			accessLevel: AccessLevel.WRITE,
		});

		const updateResult = await repository.update(updatedPolicy);
		expect(updateResult.isOk()).toBe(true);

		const fetchResult = await repository.fetchById(policy.id.toString());
		expect(fetchResult.unwrap().unwrap().accessLevel).toBe(AccessLevel.WRITE);
	});

	it("should delete an access policy", async () => {
		const { user, doc } = await setupDocumentAndUser();

		const policy = makeAccessPolicy({ documentId: doc.id, userId: user.id });
		await repository.insert(policy);

		const deleteResult = await repository.delete(policy.id.toString());
		expect(deleteResult.isOk()).toBe(true);
		expect(deleteResult.unwrap().unwrap().id.toString()).toBe(
			policy.id.toString(),
		);

		const fetchResult = await repository.fetchById(policy.id.toString());
		expect(fetchResult.unwrap().isNone()).toBe(true);
	});
});
