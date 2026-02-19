import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { UserRepositoryImpl } from "../user.repository.impl";
import { makeUser } from "@domain/__tests__/factories";
import { UserId } from "@domain/utils/refined-types";
import { PaginationOptions } from "@domain/shared/pagination";
import { UserRole } from "@domain/user/user.enums";
import { sql } from "drizzle-orm";

describe("UserRepositoryImpl Integration Tests", () => {
  let testDb: TestDbContainer;
  let repository: UserRepositoryImpl;

  beforeAll(async () => {
    testDb = new TestDbContainer();
    const result = await testDb.start();
    repository = new UserRepositoryImpl(result.db);
  }, 120000); // Increased timeout for slow container starts

  afterAll(async () => {
    if (testDb) await testDb.stop();
  });

  beforeEach(async () => {
    // Clear the users table before each test using a raw SQL command
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
        email: user.email.toString() as any,
        passwordHash: user.passwordHash
    });
    
    const updateResult = await repository.update(updatedUser);
    expect(updateResult.isOk()).toBe(true);

    const fetchResult = await repository.fetchById(user.id.toString());
    const fetchedUser = fetchResult.unwrap().unwrap();
    expect(fetchedUser.displayName).toBe("Updated Name");
  });

  it("should fetch active users with pagination", async () => {
    // Insert 15 active users
    for (let i = 0; i < 15; i++) {
      await repository.insert(makeUser({ isActive: true }));
    }
    // Insert 5 inactive users
    for (let i = 0; i < 5; i++) {
        await repository.insert(makeUser({ isActive: false }));
    }

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchActiveUsers(options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(10);
    expect(paginated.totalPages).toBe(2);
  });

  it("should search users by email fragment", async () => {
    const user1 = makeUser({ email: "alice@test.com" as any });
    const user2 = makeUser({ email: "bob@test.com" as any });
    await repository.insert(user1);
    await repository.insert(user2);

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.search("alice", options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(1);
    expect(paginated.data[0].email.toString()).toBe("alice@test.com");
  });

  it("should delete a user and return the deleted entity", async () => {
    const user = makeUser();
    await repository.insert(user);

    const deleteResult = await repository.delete(user.id.toString());
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap().unwrap().id.toString()).toBe(user.id.toString());

    const fetchResult = await repository.fetchById(user.id.toString());
    expect(fetchResult.unwrap().isNone()).toBe(true);
  });

  it("should check if email exists", async () => {
      const email = "exists@test.com";
      const user = makeUser({ email: email as any });
      await repository.insert(user);

      const existsResult = await repository.existsByEmail(email);
      expect(existsResult.isOk()).toBe(true);
      expect(existsResult.unwrap()).toBe(true);

      const notExistsResult = await repository.existsByEmail("not@exists.com");
      expect(notExistsResult.unwrap()).toBe(false);
  });
});
