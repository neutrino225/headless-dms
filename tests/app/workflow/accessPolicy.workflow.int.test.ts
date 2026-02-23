import "reflect-metadata";
import { AccessPolicyNotFoundError } from "@domain/access-policy/access-policy.errors";
import { AccessLevel } from "@domain/document/document.enums";
import { DocumentNotFoundError } from "@domain/document/document.errors";
import { UserRole } from "@domain/user/user.enums";
import { UserNotFoundError } from "@domain/user/user.errors";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	makeCheckAccessQuery,
	makeCreateDocumentCommand,
	makeCreateUserCommand,
	makeGrantAccessCommand,
	makeRevokeAccessCommand,
	makeUpdateAccessCommand,
} from "../factories/dto.factories";
import {
	expectEffectFailure,
	expectEffectSuccess,
} from "../utils/effect.test-utils";
import {
	createWorkflowTestContext,
	truncateAll,
	type WorkflowTestContext,
} from "../utils/workflow-test.setup";

describe("AccessPolicyWorkflows Integration Tests", () => {
	let ctx: WorkflowTestContext;

	beforeAll(async () => {
		ctx = await createWorkflowTestContext();
	}, 120_000);

	afterAll(async () => {
		if (ctx?.testDb) await ctx.testDb.stop();
	});

	beforeEach(async () => {
		await truncateAll(ctx.testDb);
	});

	// ─── Helpers ──────────────────────────────────────────────────────────────

	async function seedOwnerDocumentAndUser() {
		const owner = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({ email: "owner@test.com" }),
			),
		);
		const doc = await expectEffectSuccess(
			ctx.documentWorkflows.createDocument(
				makeCreateDocumentCommand(owner.id, { slug: "policy-test-doc" }),
			),
		);
		const reader = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({ email: "reader@test.com" }),
			),
		);
		return { owner, doc, reader };
	}

	// ─── Grant Access ─────────────────────────────────────────────────────────

	describe("grantAccess", () => {
		it("should grant READ access to a user on a document", async () => {
			const { owner, doc, reader } = await seedOwnerDocumentAndUser();

			const policy = await expectEffectSuccess(
				ctx.accessPolicyWorkflows.grantAccess(
					makeGrantAccessCommand({
						documentId: doc.id,
						userId: reader.id,
						grantedBy: owner.id,
						accessLevel: AccessLevel.READ,
					}),
				),
			);

			expect(policy.documentId).toBe(doc.id);
			expect(policy.userId).toBe(reader.id);
			expect(policy.accessLevel).toBe(AccessLevel.READ);
		});

		it("should fail when document does not exist", async () => {
			const owner = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({ email: "grantor@test.com" }),
				),
			);
			const reader = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({ email: "grantee@test.com" }),
				),
			);

			const err = await expectEffectFailure(
				ctx.accessPolicyWorkflows.grantAccess(
					makeGrantAccessCommand({
						documentId: crypto.randomUUID(),
						userId: reader.id,
						grantedBy: owner.id,
					}),
				),
			);
			expect(err).toBeInstanceOf(DocumentNotFoundError);
		});

		it("should fail when user does not exist", async () => {
			const owner = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({ email: "grantor2@test.com" }),
				),
			);
			const doc = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(
					makeCreateDocumentCommand(owner.id, { slug: "grant-fail-doc" }),
				),
			);

			const err = await expectEffectFailure(
				ctx.accessPolicyWorkflows.grantAccess(
					makeGrantAccessCommand({
						documentId: doc.id,
						userId: crypto.randomUUID(),
						grantedBy: owner.id,
					}),
				),
			);
			expect(err).toBeInstanceOf(UserNotFoundError);
		});
	});

	// ─── Update Access ────────────────────────────────────────────────────────

	describe("updateAccess", () => {
		it("should upgrade access level from READ to WRITE", async () => {
			const { owner, doc, reader } = await seedOwnerDocumentAndUser();
			const policy = await expectEffectSuccess(
				ctx.accessPolicyWorkflows.grantAccess(
					makeGrantAccessCommand({
						documentId: doc.id,
						userId: reader.id,
						grantedBy: owner.id,
						accessLevel: AccessLevel.READ,
					}),
				),
			);

			const updated = await expectEffectSuccess(
				ctx.accessPolicyWorkflows.updateAccess(
					makeUpdateAccessCommand(policy.id, AccessLevel.WRITE),
				),
			);

			expect(updated.accessLevel).toBe(AccessLevel.WRITE);
		});

		it("should fail when policy does not exist", async () => {
			const err = await expectEffectFailure(
				ctx.accessPolicyWorkflows.updateAccess(
					makeUpdateAccessCommand(crypto.randomUUID(), AccessLevel.READ),
				),
			);
			expect(err).toBeInstanceOf(AccessPolicyNotFoundError);
		});
	});

	// ─── Revoke Access ────────────────────────────────────────────────────────

	describe("revokeAccess", () => {
		it("should revoke access by deleting the policy", async () => {
			const { owner, doc, reader } = await seedOwnerDocumentAndUser();
			const policy = await expectEffectSuccess(
				ctx.accessPolicyWorkflows.grantAccess(
					makeGrantAccessCommand({
						documentId: doc.id,
						userId: reader.id,
						grantedBy: owner.id,
					}),
				),
			);

			const revoked = await expectEffectSuccess(
				ctx.accessPolicyWorkflows.revokeAccess(
					makeRevokeAccessCommand(policy.id),
				),
			);

			expect(revoked.id).toBe(policy.id);
		});

		it("should fail when revoking non-existent policy", async () => {
			const err = await expectEffectFailure(
				ctx.accessPolicyWorkflows.revokeAccess(
					makeRevokeAccessCommand(crypto.randomUUID()),
				),
			);
			expect(err).toBeInstanceOf(AccessPolicyNotFoundError);
		});
	});

	// ─── Check Access ─────────────────────────────────────────────────────────

	describe("checkAccess", () => {
		it("should allow access when policy grants sufficient level", async () => {
			const { owner, doc, reader } = await seedOwnerDocumentAndUser();
			await expectEffectSuccess(
				ctx.accessPolicyWorkflows.grantAccess(
					makeGrantAccessCommand({
						documentId: doc.id,
						userId: reader.id,
						grantedBy: owner.id,
						accessLevel: AccessLevel.WRITE,
					}),
				),
			);

			// READ is within WRITE level, so this should succeed
			await expectEffectSuccess(
				ctx.accessPolicyWorkflows.checkAccess(
					makeCheckAccessQuery(reader.id, doc.id, AccessLevel.READ),
				),
			);
		});

		it("should deny access when policy level is insufficient", async () => {
			const { owner, doc, reader } = await seedOwnerDocumentAndUser();
			await expectEffectSuccess(
				ctx.accessPolicyWorkflows.grantAccess(
					makeGrantAccessCommand({
						documentId: doc.id,
						userId: reader.id,
						grantedBy: owner.id,
						accessLevel: AccessLevel.READ,
					}),
				),
			);

			// WRITE requires more than READ
			const err = await expectEffectFailure(
				ctx.accessPolicyWorkflows.checkAccess(
					makeCheckAccessQuery(reader.id, doc.id, AccessLevel.WRITE),
				),
			);
			expect(err).toBeDefined();
		});

		it("should allow owner access without explicit policy", async () => {
			const { owner, doc } = await seedOwnerDocumentAndUser();

			// Owner should always have access
			await expectEffectSuccess(
				ctx.accessPolicyWorkflows.checkAccess(
					makeCheckAccessQuery(owner.id, doc.id, AccessLevel.DELETE),
				),
			);
		});

		it("should allow admin access without explicit policy", async () => {
			const admin = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({
						email: "admin@test.com",
						role: UserRole.ADMIN,
					}),
				),
			);
			const owner = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({ email: "docowner@test.com" }),
				),
			);
			const doc = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(
					makeCreateDocumentCommand(owner.id, { slug: "admin-access" }),
				),
			);

			// Admin should always have access
			await expectEffectSuccess(
				ctx.accessPolicyWorkflows.checkAccess(
					makeCheckAccessQuery(admin.id, doc.id, AccessLevel.DELETE),
				),
			);
		});
	});
});
