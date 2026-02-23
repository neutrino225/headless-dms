import "reflect-metadata";
import { AccessLevel, DocumentStatus } from "@domain/document/document.enums";
import { UserRole } from "@domain/user/user.enums";
import { describeIntegration } from "@tests/utils/integration";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import {
	makeChangeStatusCommand,
	makeCheckAccessQuery,
	makeConfirmUploadCommand,
	makeCreateDocumentCommand,
	makeCreateUserCommand,
	makeGrantAccessCommand,
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

/**
 * Full lifecycle integration test:
 *
 * 1. Create users (owner, collaborator, admin)
 * 2. Create a document
 * 3. Upload multiple versions
 * 4. Grant access to collaborator
 * 5. Verify access control
 * 6. Archive → restore → delete flow
 *
 * This test exercises the entire application layer through real workflows
 * backed by a real PostgreSQL database (via Testcontainers).
 */
describeIntegration("Full Document Lifecycle Integration Tests", () => {
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

	it("should complete the full document lifecycle: create → upload → access → status transitions", async () => {
		// ─── Step 1: Create users ───────────────────────────────────────────
		const owner = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({
					email: "owner@company.com",
					displayName: "Doc Owner",
				}),
			),
		);
		const collaborator = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({
					email: "collab@company.com",
					displayName: "Collaborator",
				}),
			),
		);
		const admin = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({
					email: "admin@company.com",
					role: UserRole.ADMIN,
					displayName: "Admin",
				}),
			),
		);

		expect(owner.role).toBe(UserRole.USER);
		expect(admin.role).toBe(UserRole.ADMIN);

		// ─── Step 2: Create a document ──────────────────────────────────────
		const doc = await expectEffectSuccess(
			ctx.documentWorkflows.createDocument(
				makeCreateDocumentCommand(owner.id, {
					name: "Quarterly Report Q4",
					slug: "quarterly-report-q4",
					mimeType: "application/pdf",
					metadata: { department: "finance", quarter: "Q4" },
				}),
			),
		);

		expect(doc.name).toBe("Quarterly Report Q4");
		expect(doc.status).toBe(DocumentStatus.Active);
		expect(doc.latestVersionId.isNone()).toBe(true);

		// ─── Step 3: Upload first version ───────────────────────────────────
		const v1 = await expectEffectSuccess(
			ctx.uploadWorkflows.confirmUpload(
				makeConfirmUploadCommand({
					documentId: doc.id,
					uploadedBy: owner.id,
					storageKey: "s3://bucket/quarterly/v1-draft.pdf",
					mimeType: "application/pdf",
					sizeBytes: 524288,
					checksum: "a1b2c3d4".padEnd(64, "0"),
				}),
			),
		);

		expect(v1.versionNumber).toBe(1);
		expect(v1.documentId).toBe(doc.id);

		// Verify document was updated
		const afterV1 = await expectEffectSuccess(
			ctx.documentWorkflows.getDocumentById(doc.id),
		);
		expect(afterV1.latestVersionId.isSome()).toBe(true);

		// ─── Step 4: Upload second version ──────────────────────────────────
		const v2 = await expectEffectSuccess(
			ctx.uploadWorkflows.confirmUpload(
				makeConfirmUploadCommand({
					documentId: doc.id,
					uploadedBy: owner.id,
					storageKey: "s3://bucket/quarterly/v2-final.pdf",
					mimeType: "application/pdf",
					sizeBytes: 1048576,
					checksum: "e5f6a7b8".padEnd(64, "0"),
				}),
			),
		);

		expect(v2.versionNumber).toBe(2);

		// Latest version should be v2
		const latest = await expectEffectSuccess(
			ctx.uploadWorkflows.getLatestVersion(doc.id),
		);
		expect(latest.id).toBe(v2.id);

		// ─── Step 5: Grant access to collaborator ───────────────────────────
		const policy = await expectEffectSuccess(
			ctx.accessPolicyWorkflows.grantAccess(
				makeGrantAccessCommand({
					documentId: doc.id,
					userId: collaborator.id,
					grantedBy: owner.id,
					accessLevel: AccessLevel.WRITE,
				}),
			),
		);

		expect(policy.accessLevel).toBe(AccessLevel.WRITE);

		// ─── Step 6: Verify access control ──────────────────────────────────

		// Collaborator should have READ access (within WRITE)
		await expectEffectSuccess(
			ctx.accessPolicyWorkflows.checkAccess(
				makeCheckAccessQuery(collaborator.id, doc.id, AccessLevel.READ),
			),
		);

		// Collaborator should have WRITE access
		await expectEffectSuccess(
			ctx.accessPolicyWorkflows.checkAccess(
				makeCheckAccessQuery(collaborator.id, doc.id, AccessLevel.WRITE),
			),
		);

		// Collaborator should NOT have DELETE access
		const denyResult = await expectEffectFailure(
			ctx.accessPolicyWorkflows.checkAccess(
				makeCheckAccessQuery(collaborator.id, doc.id, AccessLevel.DELETE),
			),
		);
		expect(denyResult).toBeDefined();

		// Owner always has access (no explicit policy needed)
		await expectEffectSuccess(
			ctx.accessPolicyWorkflows.checkAccess(
				makeCheckAccessQuery(owner.id, doc.id, AccessLevel.DELETE),
			),
		);

		// Admin always has access
		await expectEffectSuccess(
			ctx.accessPolicyWorkflows.checkAccess(
				makeCheckAccessQuery(admin.id, doc.id, AccessLevel.DELETE),
			),
		);

		// ─── Step 7: Archive the document ───────────────────────────────────
		const archived = await expectEffectSuccess(
			ctx.documentWorkflows.changeDocumentStatus(
				makeChangeStatusCommand(doc.id, DocumentStatus.Archived),
			),
		);
		expect(archived.status).toBe(DocumentStatus.Archived);

		// ─── Step 8: Restore the document ───────────────────────────────────
		const restored = await expectEffectSuccess(
			ctx.documentWorkflows.changeDocumentStatus(
				makeChangeStatusCommand(doc.id, DocumentStatus.Active),
			),
		);
		expect(restored.status).toBe(DocumentStatus.Active);

		// ─── Step 9: List versions (should still have 2) ────────────────────
		const versions = await expectEffectSuccess(
			ctx.uploadWorkflows.listVersions({
				documentId: doc.id,
				pageNum: 1,
				pageSize: 10,
			}),
		);
		expect(versions.data.length).toBe(2);

		// ─── Step 10: Delete the document ───────────────────────────────────
		const deleted = await expectEffectSuccess(
			ctx.documentWorkflows.deleteDocument({ id: doc.id }),
		);
		expect(deleted.id).toBe(doc.id);
	});

	it("should handle concurrent document creation and resource isolation", async () => {
		const user1 = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({ email: "user1@test.com" }),
			),
		);
		const user2 = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({ email: "user2@test.com" }),
			),
		);

		// Create documents for different owners
		const [doc1, doc2] = await Promise.all([
			expectEffectSuccess(
				ctx.documentWorkflows.createDocument(
					makeCreateDocumentCommand(user1.id, {
						name: "User1 Doc",
						slug: "user1-doc",
					}),
				),
			),
			expectEffectSuccess(
				ctx.documentWorkflows.createDocument(
					makeCreateDocumentCommand(user2.id, {
						name: "User2 Doc",
						slug: "user2-doc",
					}),
				),
			),
		]);

		expect(doc1.ownerId).toBe(user1.id);
		expect(doc2.ownerId).toBe(user2.id);

		// Each owner should only see their own documents (when filtered)
		const [list1, list2] = await Promise.all([
			expectEffectSuccess(
				ctx.documentWorkflows.listDocuments({
					ownerId: user1.id,
					pageNum: 1,
					pageSize: 100,
				}),
			),
			expectEffectSuccess(
				ctx.documentWorkflows.listDocuments({
					ownerId: user2.id,
					pageNum: 1,
					pageSize: 100,
				}),
			),
		]);

		expect(list1.data.length).toBe(1);
		expect(list1.data[0]?.name).toBe("User1 Doc");
		expect(list2.data.length).toBe(1);
		expect(list2.data[0]?.name).toBe("User2 Doc");
	});

	it("should enforce access revocation", async () => {
		const owner = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({ email: "revokeowner@test.com" }),
			),
		);
		const viewer = await expectEffectSuccess(
			ctx.userWorkflows.createUser(
				makeCreateUserCommand({ email: "revokeviewer@test.com" }),
			),
		);
		const doc = await expectEffectSuccess(
			ctx.documentWorkflows.createDocument(
				makeCreateDocumentCommand(owner.id, { slug: "revoke-test" }),
			),
		);

		// Grant and verify access
		const policy = await expectEffectSuccess(
			ctx.accessPolicyWorkflows.grantAccess(
				makeGrantAccessCommand({
					documentId: doc.id,
					userId: viewer.id,
					grantedBy: owner.id,
					accessLevel: AccessLevel.READ,
				}),
			),
		);

		await expectEffectSuccess(
			ctx.accessPolicyWorkflows.checkAccess(
				makeCheckAccessQuery(viewer.id, doc.id, AccessLevel.READ),
			),
		);

		// Revoke access
		await expectEffectSuccess(
			ctx.accessPolicyWorkflows.revokeAccess({ policyId: policy.id }),
		);

		// Viewer should no longer have access
		const err = await expectEffectFailure(
			ctx.accessPolicyWorkflows.checkAccess(
				makeCheckAccessQuery(viewer.id, doc.id, AccessLevel.READ),
			),
		);
		expect(err).toBeDefined();
	});
});
