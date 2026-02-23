import "reflect-metadata";
import { UserRepositoryImpl } from "@infra/repositories/user.repository.impl";
import { makeUser } from "@tests/domain/factories";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TestDbContainer } from "../utils/test-db";

describe("UserRepositoryImpl Integration Tests", () => {
	let testDb: TestDbContainer;
	let repository: UserRepositoryImpl;

	beforeAll(async () => {
		testDb = new TestDbContainer();
		const result = await testDb.start();
		repository = new UserRepositoryImpl(result.db);
	}, 120000);

	afterAll(async () => {
		if (testDb) await testDb.stop();
	});

	beforeEach(async () => {
		await testDb.db.execute(sql`TRUNCATE TABLE users CASCADE`);
	});

	it("should insert and fetch a user by ID", async () => {
		const user = makeUser();
		const insertResult = await repository.insert(user);
		expect(insertResult.isOk()).toBe(true);

		const fetchResult = await repository.fetchById(user.id.toString());
		expect(fetchResult.isOk()).toBe(true);
		const maybeUser = fetchResult.unwrap();
		expect(maybeUser.isSome()).toBe(true);
		const fetchedUser = maybeUser.unwrap();
		expect(fetchedUser.id.toString()).toBe(user.id.toString());
		expect(fetchedUser.email.toString()).toBe(user.email.toString());
	});

	it("should update a user and rehydrate correctly", async () => {
		const user = makeUser({ displayName: "Original Name" });
		await repository.insert(user);

		const updatedUser = makeUser({
			id: user.id,
			displayName: "Updated Name",
			email: user.email,
			passwordHash: user.passwordHash,
		});

		const updateResult = await repository.update(updatedUser);
		expect(updateResult.isOk()).toBe(true);

		const fetchResult = await repository.fetchById(user.id.toString());
		const fetchedUser = fetchResult.unwrap().unwrap();
		expect(fetchedUser.displayName).toBe("Updated Name");
	});

	it("should fetch a user by email", async () => {
		const user = makeUser();
		await repository.insert(user);

		const fetchResult = await repository.fetchByEmail(user.email.toString());
		expect(fetchResult.isOk()).toBe(true);
		const maybeUser = fetchResult.unwrap();
		expect(maybeUser.isSome()).toBe(true);
		expect(maybeUser.unwrap().id.toString()).toBe(user.id.toString());
	});

	it("should delete a user and return the deleted entity", async () => {
		const user = makeUser();
		await repository.insert(user);

		const deleteResult = await repository.delete(user.id.toString());
		expect(deleteResult.isOk()).toBe(true);
		const deletedUser = deleteResult.unwrap().unwrap();
		expect(deletedUser.id.toString()).toBe(user.id.toString());

		const fetchResult = await repository.fetchById(user.id.toString());
		expect(fetchResult.unwrap().isNone()).toBe(true);
	});
});
