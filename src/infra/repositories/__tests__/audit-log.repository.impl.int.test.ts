import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { AuditLogRepositoryImpl } from "../audit-log.repository.impl";
import { UserRepositoryImpl } from "../user.repository.impl";
import { makeAuditLog, makeUser, TEST_IDS } from "@domain/__tests__/factories";
import { PaginationOptions } from "@domain/shared/pagination";
import { AuditAction } from "@domain/audit-log/audit-log.enums";
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

  it("should fetch audit logs by user ID", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    // Insert 15 audit logs for the user
    for (let i = 0; i < 15; i++) {
      await repository.insert(makeAuditLog({ userId: user.id.toString() }));
    }

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByUserId(user.id.toString(), options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(10);
    expect(paginated.totalPages).toBe(2);
  });

  it("should fetch audit logs by resource", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    const resourceId = TEST_IDS.doc1.toString();
    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceId, resourceType: "document" }));
    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceId, resourceType: "document" }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByResource(resourceId, "document", options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
    expect(paginated.data.every(l => l.resourceId.toString() === resourceId)).toBe(true);
  });

  it("should fetch audit logs by resource type", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceType: "document" }));
    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceType: "document" }));
    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceType: "user" }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByResourceType("document", options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
    expect(paginated.data.every(l => l.resourceType === "document")).toBe(true);
  });

  it("should fetch audit logs by action", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    await repository.insert(makeAuditLog({ userId: user.id.toString(), action: AuditAction.DOCUMENT_CREATED }));
    await repository.insert(makeAuditLog({ userId: user.id.toString(), action: AuditAction.DOCUMENT_CREATED }));
    await repository.insert(makeAuditLog({ userId: user.id.toString(), action: AuditAction.DOCUMENT_UPDATED }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByAction(AuditAction.DOCUMENT_CREATED, options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
    expect(paginated.data.every(l => l.action === AuditAction.DOCUMENT_CREATED)).toBe(true);
  });

  it("should fetch audit logs by date range", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    // Insert logs
    await repository.insert(makeAuditLog({ userId: user.id.toString() }));
    await repository.insert(makeAuditLog({ userId: user.id.toString() }));

    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByDateRange(startDate, endDate, options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
  });

  it("should fetch audit logs by user and resource", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    const resourceId = TEST_IDS.doc1.toString();
    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceId, resourceType: "document" }));
    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceId, resourceType: "document" }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByUserAndResource(user.id.toString(), resourceId, options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
  });

  it("should count audit logs by user ID", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    await repository.insert(makeAuditLog({ userId: user.id.toString() }));
    await repository.insert(makeAuditLog({ userId: user.id.toString() }));
    await repository.insert(makeAuditLog({ userId: user.id.toString() }));

    const countResult = await repository.countByUserId(user.id.toString());
    expect(countResult.isOk()).toBe(true);
    expect(countResult.unwrap()).toBe(3);
  });

  it("should count audit logs by resource", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    const resourceId = TEST_IDS.doc1.toString();
    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceId, resourceType: "document" }));
    await repository.insert(makeAuditLog({ userId: user.id.toString(), resourceId, resourceType: "document" }));

    const countResult = await repository.countByResource(resourceId, "document");
    expect(countResult.isOk()).toBe(true);
    expect(countResult.unwrap()).toBe(2);
  });

  it("should count audit logs by date range", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    await repository.insert(makeAuditLog({ userId: user.id.toString() }));
    await repository.insert(makeAuditLog({ userId: user.id.toString() }));

    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const countResult = await repository.countByDateRange(startDate, endDate);
    expect(countResult.isOk()).toBe(true);
    expect(countResult.unwrap()).toBe(2);
  });

  it("should search audit logs", async () => {
    const user = makeUser();
    await userRepository.insert(user);

    await repository.insert(makeAuditLog({ userId: user.id.toString(), action: AuditAction.DOCUMENT_CREATED }));
    await repository.insert(makeAuditLog({ userId: user.id.toString(), action: AuditAction.DOCUMENT_UPDATED }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.search("CREATED", options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(1);
  });
});
