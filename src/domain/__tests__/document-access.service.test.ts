import {
	AccessLevel,
	DocumentStatus,
} from "src/domain/document/document.enums";
import {
	DocumentAccessDeniedError,
	NoAccessPolicyError,
} from "src/domain/services/document-access.errors";
import { canAccess } from "src/domain/services/document-access.service";
import { describe, expect, it } from "vitest";
import {
	makeAccessPolicy,
	makeAdminUser,
	makeDocument,
	makeDocumentWithStatus,
	makeUser,
	TEST_IDS,
} from "./factories";

describe("DocumentAccessService — canAccess()", () => {
	// ─── Rule 1: Admin always wins ──────────────────────────────────────────────

	describe("Admin user", () => {
		it("grants READ access to an admin with no policies", () => {
			const admin = makeAdminUser();
			const doc = makeDocument({ ownerId: TEST_IDS.user2 }); // admin is not owner
			expect(canAccess(admin, doc, [], AccessLevel.READ).isOk()).toBe(true);
		});

		it("grants WRITE access to an admin with no policies", () => {
			const admin = makeAdminUser();
			const doc = makeDocument({ ownerId: TEST_IDS.user2 });
			expect(canAccess(admin, doc, [], AccessLevel.WRITE).isOk()).toBe(true);
		});

		it("grants DELETE access to an admin with no policies", () => {
			const admin = makeAdminUser();
			const doc = makeDocument({ ownerId: TEST_IDS.user2 });
			expect(canAccess(admin, doc, [], AccessLevel.DELETE).isOk()).toBe(true);
		});

		it("grants access to an admin even on an archived document", () => {
			const admin = makeAdminUser();
			const doc = makeDocumentWithStatus(DocumentStatus.Archived, {
				ownerId: TEST_IDS.user2,
			});
			expect(canAccess(admin, doc, [], AccessLevel.DELETE).isOk()).toBe(true);
		});
	});

	// ─── Rule 2: Owner always wins ──────────────────────────────────────────────

	describe("Document owner", () => {
		it("grants READ access to the document owner", () => {
			const owner = makeUser({ id: TEST_IDS.user1 });
			const doc = makeDocument({ ownerId: TEST_IDS.user1 });
			expect(canAccess(owner, doc, [], AccessLevel.READ).isOk()).toBe(true);
		});

		it("grants DELETE access to the document owner", () => {
			const owner = makeUser({ id: TEST_IDS.user1 });
			const doc = makeDocument({ ownerId: TEST_IDS.user1 });
			expect(canAccess(owner, doc, [], AccessLevel.DELETE).isOk()).toBe(true);
		});

		it("grants access to owner even with no policies", () => {
			const owner = makeUser({ id: TEST_IDS.user1 });
			const doc = makeDocument({ ownerId: TEST_IDS.user1 });
			expect(canAccess(owner, doc, [], AccessLevel.WRITE).isOk()).toBe(true);
		});
	});

	// ─── Rule 3: Explicit subject policy ────────────────────────────────────────

	describe("Explicit subject policy", () => {
		it("grants READ access when user has a READ policy", () => {
			const user = makeUser({ id: TEST_IDS.user2 });
			const doc = makeDocument({ id: TEST_IDS.doc1, ownerId: TEST_IDS.user1 });
			const policy = makeAccessPolicy({
				documentId: TEST_IDS.doc1,
				userId: TEST_IDS.user2,
				accessLevel: AccessLevel.READ,
			});

			expect(canAccess(user, doc, [policy], AccessLevel.READ).isOk()).toBe(
				true,
			);
		});

		it("denies WRITE access when user only has a READ policy", () => {
			const user = makeUser({ id: TEST_IDS.user2 });
			const doc = makeDocument({ id: TEST_IDS.doc1, ownerId: TEST_IDS.user1 });
			const policy = makeAccessPolicy({
				documentId: TEST_IDS.doc1,
				userId: TEST_IDS.user2,
				accessLevel: AccessLevel.READ,
			});

			const result = canAccess(user, doc, [policy], AccessLevel.WRITE);
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(DocumentAccessDeniedError);
		});

		it("grants WRITE and READ access when user has a WRITE policy", () => {
			const user = makeUser({ id: TEST_IDS.user2 });
			const doc = makeDocument({ id: TEST_IDS.doc1, ownerId: TEST_IDS.user1 });
			const policy = makeAccessPolicy({
				documentId: TEST_IDS.doc1,
				userId: TEST_IDS.user2,
				accessLevel: AccessLevel.WRITE,
			});

			expect(canAccess(user, doc, [policy], AccessLevel.READ).isOk()).toBe(
				true,
			);
			expect(canAccess(user, doc, [policy], AccessLevel.WRITE).isOk()).toBe(
				true,
			);

			const deleteResult = canAccess(user, doc, [policy], AccessLevel.DELETE);
			expect(deleteResult.isErr()).toBe(true);
			expect(deleteResult.unwrapErr()).toBeInstanceOf(
				DocumentAccessDeniedError,
			);
		});

		it("grants all access levels when user has a DELETE policy", () => {
			const user = makeUser({ id: TEST_IDS.user2 });
			const doc = makeDocument({ id: TEST_IDS.doc1, ownerId: TEST_IDS.user1 });
			const policy = makeAccessPolicy({
				documentId: TEST_IDS.doc1,
				userId: TEST_IDS.user2,
				accessLevel: AccessLevel.DELETE,
			});

			expect(canAccess(user, doc, [policy], AccessLevel.READ).isOk()).toBe(
				true,
			);
			expect(canAccess(user, doc, [policy], AccessLevel.WRITE).isOk()).toBe(
				true,
			);
			expect(canAccess(user, doc, [policy], AccessLevel.DELETE).isOk()).toBe(
				true,
			);
		});

		it("ignores policies for a different document", () => {
			const user = makeUser({ id: TEST_IDS.user2 });
			const doc = makeDocument({ id: TEST_IDS.doc1, ownerId: TEST_IDS.user1 });
			// Policy is for doc2, not doc1
			const policy = makeAccessPolicy({
				documentId: TEST_IDS.doc2,
				userId: TEST_IDS.user2,
				accessLevel: AccessLevel.DELETE,
			});

			const result = canAccess(user, doc, [policy], AccessLevel.READ);
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(NoAccessPolicyError);
		});

		it("ignores policies for a different user", () => {
			const user = makeUser({ id: TEST_IDS.user2 });
			const doc = makeDocument({ id: TEST_IDS.doc1, ownerId: TEST_IDS.user1 });
			// Policy is for user1, not user2
			const policy = makeAccessPolicy({
				documentId: TEST_IDS.doc1,
				userId: TEST_IDS.user1,
				accessLevel: AccessLevel.DELETE,
			});

			const result = canAccess(user, doc, [policy], AccessLevel.READ);
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(NoAccessPolicyError);
		});
	});

	// ─── Rule 4: Default deny ────────────────────────────────────────────────────

	describe("Default deny", () => {
		it("denies access to a non-owner with no policies", () => {
			const user = makeUser({ id: TEST_IDS.user2 });
			const doc = makeDocument({ ownerId: TEST_IDS.user1 });

			const readResult = canAccess(user, doc, [], AccessLevel.READ);
			expect(readResult.isErr()).toBe(true);
			expect(readResult.unwrapErr()).toBeInstanceOf(NoAccessPolicyError);

			expect(canAccess(user, doc, [], AccessLevel.WRITE).isErr()).toBe(true);
			expect(canAccess(user, doc, [], AccessLevel.DELETE).isErr()).toBe(true);
		});

		it("denies access when policies list is empty", () => {
			const user = makeUser({ id: TEST_IDS.user2 });
			const doc = makeDocument({ ownerId: TEST_IDS.user1 });

			const result = canAccess(user, doc, [], AccessLevel.READ);
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(NoAccessPolicyError);
		});
	});

	// ─── Precedence ──────────────────────────────────────────────────────────────

	describe("Precedence: Admin > Owner > Policy > Deny", () => {
		it("admin wins even if they have no explicit policy", () => {
			const admin = makeAdminUser();
			const doc = makeDocument({ ownerId: TEST_IDS.user1 }); // admin is not owner
			expect(canAccess(admin, doc, [], AccessLevel.DELETE).isOk()).toBe(true);
		});

		it("owner wins even if they have a restrictive policy", () => {
			const owner = makeUser({ id: TEST_IDS.user1 });
			const doc = makeDocument({ id: TEST_IDS.doc1, ownerId: TEST_IDS.user1 });
			// A READ-only policy exists for the owner — but ownership overrides it
			const policy = makeAccessPolicy({
				documentId: TEST_IDS.doc1,
				userId: TEST_IDS.user1,
				accessLevel: AccessLevel.READ,
			});

			expect(canAccess(owner, doc, [policy], AccessLevel.DELETE).isOk()).toBe(
				true,
			);
		});
	});
});
