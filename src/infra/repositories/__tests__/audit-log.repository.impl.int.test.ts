import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { AuditLogRepositoryImpl } from "../audit-log.repository.impl";
import { UserRepositoryImpl } from "../user.repository.impl";
import { makeAuditLog, makeUser } from "@domain/__tests__/factories";
import { sql } from "drizzle-orm";

describe("AuditLogRepositoryImpl Integration Tests", () => {
  let testDb: TestDbContainer;
  let repository: AuditLogRepositoryImpl;
  let userRepository: UserRepositoryImpl;

  beforeAll(async () => {
    testDb = new TestDbContainer();
    const result = await testDb.start();
    repository = new AuditLogRepositoryImpl(result.db);
    userRepository = new UserRepositoryImpl(result.db);
  }, 120000);

  afterAll(async () => {
    if (testDb) await testDb.stop();
  });

  beforeEach(async () => {
    await testDb.db.execute(sql`TRUNCATE TABLE audit_logs, users CASCADE`);
  });

  it("should insert and fetch an audit log by ID", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    const log = makeAuditLog({ userId: user.id.toString() });
    const insertResult = await repository.insert(log);
    expect(insertResult.isOk()).toBe(true);

    const fetchResult = await repository.fetchById(log.id.toString());
    expect(fetchResult.isOk()).toBe(true);
    const maybeLog = fetchResult.unwrap();
    expect(maybeLog.isSome()).toBe(true);
    const fetchedLog = maybeLog.unwrap();
    expect(fetchedLog.id.toString()).toBe(log.id.toString());
    expect(fetchedLog.userId.toString()).toBe(user.id.toString());
  });
});
