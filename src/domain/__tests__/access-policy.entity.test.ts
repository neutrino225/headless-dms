import { AccessPolicy } from "src/domain/access-policy/access-policy.entity";
import { AccessLevel } from "src/domain/document/document.enums";
import { describe, expect, it } from "vitest";
import { makeAccessPolicy, TEST_IDS } from "./factories";
import { TestPatterns } from "./utils/test.helpers";

describe("AccessPolicy entity", () => {
	describe("create()", () => {
		it("creates a policy with a generated id", () => {
			const result = AccessPolicy.create({
				documentId: TEST_IDS.doc1,
				userId: TEST_IDS.user2,
				accessLevel: AccessLevel.READ,
			});

			const policy = TestPatterns.Result.expectOk(result);
			expect(policy.id).toMatch(/^[0-9a-f-]{36}$/);
			expect(policy.accessLevel).toBe(AccessLevel.READ);
		});

		it("creates policies for all access levels", () => {
			for (const level of [
				AccessLevel.READ,
				AccessLevel.WRITE,
				AccessLevel.DELETE,
			]) {
				const policy = TestPatterns.Result.expectOk(
					AccessPolicy.create({
						documentId: TEST_IDS.doc1,
						userId: TEST_IDS.user2,
						accessLevel: level,
					}),
				);
				expect(policy.accessLevel).toBe(level);
			}
		});
	});

	describe("fromSerialized()", () => {
		it("rehydrates a policy from factory-generated data", () => {
			const policy = makeAccessPolicy({
				id: TEST_IDS.policy1,
				documentId: TEST_IDS.doc1,
				userId: TEST_IDS.user2,
				accessLevel: AccessLevel.WRITE,
			});

			expect(policy.id).toBe(TEST_IDS.policy1);
			expect(policy.documentId).toBe(TEST_IDS.doc1);
			expect(policy.userId).toBe(TEST_IDS.user2);
			expect(policy.accessLevel).toBe(AccessLevel.WRITE);
		});
	});

	describe("serialize()", () => {
		it("round-trips through serialize → fromSerialized", () => {
			const original = makeAccessPolicy({ accessLevel: AccessLevel.DELETE });
			const serialized = original.serialize();
			const restored = AccessPolicy.fromSerialized(serialized);

			expect(restored.id).toBe(original.id);
			expect(restored.documentId).toBe(original.documentId);
			expect(restored.userId).toBe(original.userId);
			expect(restored.accessLevel).toBe(original.accessLevel);
		});

		it("serializes all fields to primitives", () => {
			const policy = makeAccessPolicy();
			const serialized = policy.serialize();

			expect(typeof serialized.id).toBe("string");
			expect(typeof serialized.documentId).toBe("string");
			expect(typeof serialized.userId).toBe("string");
			expect(typeof serialized.accessLevel).toBe("string");
		});
	});
});
