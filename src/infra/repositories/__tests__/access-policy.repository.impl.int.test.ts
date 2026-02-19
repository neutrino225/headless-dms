import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestDbContainer } from "../../__tests__/utils/test-db";
import { AccessPolicyRepositoryImpl } from "../access-policy.repository.impl";
import { DocumentRepositoryImpl } from "../document.repository.impl";
import { UserRepositoryImpl } from "../user.repository.impl";
import { makeAccessPolicy, makeDocument, makeUser, TEST_IDS } from "@domain/__tests__/factories";
import { PaginationOptions } from "@domain/shared/pagination";
import { AccessLevel } from "@domain/document/document.enums";
import { sql } from "drizzle-orm";

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
    await testDb.db.execute(sql`TRUNCATE TABLE access_policies, documents, users CASCADE`);
  });

  async function setupDocumentAndUser() {
    const user = makeUser();
    const doc = makeDocument();
    await userRepository.insert(user);
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

  it("should fetch policies by document ID", async () => {
    const { user: user1 } = await setupDocumentAndUser();
    const { user: user2, doc: doc2 } = await setupDocumentAndUser();

    await repository.insert(makeAccessPolicy({ documentId: doc2.id, userId: user1.id }));
    await repository.insert(makeAccessPolicy({ documentId: doc2.id, userId: user2.id }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByDocumentId(doc2.id.toString(), options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
  });

  it("should fetch policies by user ID", async () => {
    const { user, doc: doc1 } = await setupDocumentAndUser();
    const { doc: doc2 } = await setupDocumentAndUser();

    await repository.insert(makeAccessPolicy({ documentId: doc1.id, userId: user.id }));
    await repository.insert(makeAccessPolicy({ documentId: doc2.id, userId: user.id }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchByUserId(user.id.toString(), options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
  });

  it("should fetch policy by document and user", async () => {
    const { user, doc } = await setupDocumentAndUser();

    const policy = makeAccessPolicy({ documentId: doc.id, userId: user.id });
    await repository.insert(policy);

    const fetchResult = await repository.fetchByDocumentAndUser(
      doc.id.toString(),
      user.id.toString()
    );

    expect(fetchResult.isOk()).toBe(true);
    const maybePolicy = fetchResult.unwrap();
    expect(maybePolicy.isSome()).toBe(true);
    expect(maybePolicy.unwrap().id.toString()).toBe(policy.id.toString());
  });

  it("should fetch users with access to a document", async () => {
    const { user: user1, doc } = await setupDocumentAndUser();
    const { user: user2 } = await setupDocumentAndUser();

    await repository.insert(makeAccessPolicy({ documentId: doc.id, userId: user1.id, accessLevel: AccessLevel.READ }));
    await repository.insert(makeAccessPolicy({ documentId: doc.id, userId: user2.id, accessLevel: AccessLevel.WRITE }));

    const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
    const result = await repository.fetchUsersWithAccessToDocument(doc.id.toString(), options);

    expect(result.isOk()).toBe(true);
    const paginated = result.unwrap();
    expect(paginated.data.length).toBe(2);
    expect(paginated.data.some(u => u.userId === user1.id.toString())).toBe(true);
    expect(paginated.data.some(u => u.userId === user2.id.toString())).toBe(true);
  });

  it("should check if policy exists by document and user", async () => {
    const { user, doc } = await setupDocumentAndUser();

    await repository.insert(makeAccessPolicy({ documentId: doc.id, userId: user.id }));

    const existsResult = await repository.existsByDocumentAndUser(
      doc.id.toString(),
      user.id.toString()
    );
    expect(existsResult.isOk()).toBe(true);
    expect(existsResult.unwrap()).toBe(true);

    const notExistsResult = await repository.existsByDocumentAndUser(
      doc.id.toString(),
      TEST_IDS.user2.toString()
    );
    expect(notExistsResult.unwrap()).toBe(false);
  });

  it("should check if user has access level", async () => {
    const { user, doc } = await setupDocumentAndUser();

    await repository.insert(makeAccessPolicy({ documentId: doc.id, userId: user.id, accessLevel: AccessLevel.WRITE }));

    // User has WRITE, should have READ and WRITE
    const readResult = await repository.hasAccessLevel(doc.id.toString(), user.id.toString(), AccessLevel.READ);
    expect(readResult.isOk()).toBe(true);
    expect(readResult.unwrap()).toBe(true);

    const writeResult = await repository.hasAccessLevel(doc.id.toString(), user.id.toString(), AccessLevel.WRITE);
    expect(writeResult.isOk()).toBe(true);
    expect(writeResult.unwrap()).toBe(true);

    // User doesn't have DELETE
    const deleteResult = await repository.hasAccessLevel(doc.id.toString(), user.id.toString(), AccessLevel.DELETE);
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap()).toBe(false);
  });

  it("should get access level for user on document", async () => {
    const { user, doc } = await setupDocumentAndUser();

    await repository.insert(makeAccessPolicy({ documentId: doc.id, userId: user.id, accessLevel: AccessLevel.WRITE }));

    const levelResult = await repository.getAccessLevel(doc.id.toString(), user.id.toString());
    expect(levelResult.isOk()).toBe(true);
    const maybeLevel = levelResult.unwrap();
    expect(maybeLevel.isSome()).toBe(true);
    expect(maybeLevel.unwrap()).toBe(AccessLevel.WRITE);
  });

  it("should update an access policy", async () => {
    const { user, doc } = await setupDocumentAndUser();

    const policy = makeAccessPolicy({ documentId: doc.id, userId: user.id, accessLevel: AccessLevel.READ });
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
    expect(deleteResult.unwrap().unwrap().id.toString()).toBe(policy.id.toString());

    const fetchResult = await repository.fetchById(policy.id.toString());
    expect(fetchResult.unwrap().isNone()).toBe(true);
  });

  it("should delete policy by document and user", async () => {
    const { user, doc } = await setupDocumentAndUser();

    const policy = makeAccessPolicy({ documentId: doc.id, userId: user.id });
    await repository.insert(policy);

    const deleteResult = await repository.deleteByDocumentAndUser(
      doc.id.toString(),
      user.id.toString()
    );
    expect(deleteResult.isOk()).toBe(true);

    const existsResult = await repository.existsByDocumentAndUser(
      doc.id.toString(),
      user.id.toString()
    );
    expect(existsResult.unwrap()).toBe(false);
  });

  it("should delete all policies by document ID", async () => {
    const { user: user1, doc } = await setupDocumentAndUser();
    const { user: user2 } = await setupDocumentAndUser();

    await repository.insert(makeAccessPolicy({ documentId: doc.id, userId: user1.id }));
    await repository.insert(makeAccessPolicy({ documentId: doc.id, userId: user2.id }));

    const deleteResult = await repository.deleteByDocumentId(doc.id.toString());
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap()).toBe(2);
  });

  it("should delete all policies by user ID", async () => {
    const { user, doc: doc1 } = await setupDocumentAndUser();
    const { doc: doc2 } = await setupDocumentAndUser();

    await repository.insert(makeAccessPolicy({ documentId: doc1.id, userId: user.id }));
    await repository.insert(makeAccessPolicy({ documentId: doc2.id, userId: user.id }));

    const deleteResult = await repository.deleteByUserId(user.id.toString());
    expect(deleteResult.isOk()).toBe(true);
    expect(deleteResult.unwrap()).toBe(2);
  });
});
