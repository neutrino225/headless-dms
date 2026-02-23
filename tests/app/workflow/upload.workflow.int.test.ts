import "reflect-metadata";
import {
	DocumentNotFoundError,
	DocumentVersionNotFoundError,
} from "@domain/document/document.errors";
import { describeIntegration } from "@tests/utils/integration";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	makeConfirmUploadCommand,
	makeCreateDocumentCommand,
	makeCreateUserCommand,
	makeInitiateUploadCommand,
	makeListVersionsQuery,
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

describeIntegration("UploadWorkflows Integration Tests", () => {
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

	async function seedOwnerAndDocument(slug = "upload-test-doc") {
		const owner = await expectEffectSuccess(
			ctx.userWorkflows.createUser(makeCreateUserCommand()),
		);
		const doc = await expectEffectSuccess(
			ctx.documentWorkflows.createDocument(
				makeCreateDocumentCommand(owner.id, { slug }),
			),
		);
		return { owner, doc };
	}

	// ─── Initiate Upload ──────────────────────────────────────────────────────

	describe("initiateUpload", () => {
		it("should return an upload initiation with URL and expiry", async () => {
			const { owner, doc } = await seedOwnerAndDocument("initiate-test");
			const cmd = makeInitiateUploadCommand({
				documentId: doc.id,
				uploadedBy: owner.id,
			});

			const result = await expectEffectSuccess(
				ctx.uploadWorkflows.initiateUpload(cmd),
			);

			expect(result.documentId).toBe(doc.id);
			expect(result.uploadUrl).toBeTruthy();
			expect(result.expiresAt).toBeInstanceOf(Date);
			expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
		});

		it("should fail when document does not exist", async () => {
			const owner = await expectEffectSuccess(
				ctx.userWorkflows.createUser(makeCreateUserCommand()),
			);
			const cmd = makeInitiateUploadCommand({
				documentId: crypto.randomUUID(),
				uploadedBy: owner.id,
			});

			const err = await expectEffectFailure(
				ctx.uploadWorkflows.initiateUpload(cmd),
			);
			expect(err).toBeInstanceOf(DocumentNotFoundError);
		});
	});

	// ─── Confirm Upload ───────────────────────────────────────────────────────

	describe("confirmUpload", () => {
		it("should create a version and update the document", async () => {
			const { owner, doc } = await seedOwnerAndDocument("confirm-test");
			const cmd = makeConfirmUploadCommand({
				documentId: doc.id,
				uploadedBy: owner.id,
				storageKey: "s3://bucket/confirm-test/v1.pdf",
				checksum: "a".repeat(64),
			});

			const version = await expectEffectSuccess(
				ctx.uploadWorkflows.confirmUpload(cmd),
			);

			expect(version.versionNumber).toBe(1);
			expect(version.documentId).toBe(doc.id);
			expect(version.sizeBytes).toBeGreaterThan(0);

			// Verify document's latestVersionId was updated
			const updatedDoc = await expectEffectSuccess(
				ctx.documentWorkflows.getDocumentById(doc.id),
			);
			expect(updatedDoc.latestVersionId.isSome()).toBe(true);
		});

		it("should be idempotent on duplicate storageKey", async () => {
			const { owner, doc } = await seedOwnerAndDocument("idempotent-test");
			const cmd = makeConfirmUploadCommand({
				documentId: doc.id,
				uploadedBy: owner.id,
				storageKey: "s3://bucket/idempotent/v1.pdf",
				checksum: "b".repeat(64),
			});

			const first = await expectEffectSuccess(
				ctx.uploadWorkflows.confirmUpload(cmd),
			);
			const second = await expectEffectSuccess(
				ctx.uploadWorkflows.confirmUpload(cmd),
			);

			// Same version returned on duplicate
			expect(second.id).toBe(first.id);
			expect(second.storageKey).toBe(first.storageKey);
		});

		it("should increment version numbers across uploads", async () => {
			const { owner, doc } = await seedOwnerAndDocument("multi-version");
			const v1 = await expectEffectSuccess(
				ctx.uploadWorkflows.confirmUpload(
					makeConfirmUploadCommand({
						documentId: doc.id,
						uploadedBy: owner.id,
						storageKey: "s3://bucket/multi/v1.pdf",
						checksum: "c".repeat(64),
					}),
				),
			);
			const v2 = await expectEffectSuccess(
				ctx.uploadWorkflows.confirmUpload(
					makeConfirmUploadCommand({
						documentId: doc.id,
						uploadedBy: owner.id,
						storageKey: "s3://bucket/multi/v2.pdf",
						checksum: "d".repeat(64),
					}),
				),
			);

			expect(v1.versionNumber).toBe(1);
			expect(v2.versionNumber).toBe(2);
		});
	});

	// ─── List Versions ────────────────────────────────────────────────────────

	describe("listVersions", () => {
		it("should list all versions for a document", async () => {
			const { owner, doc } = await seedOwnerAndDocument("list-ver");
			for (let i = 0; i < 3; i++) {
				await expectEffectSuccess(
					ctx.uploadWorkflows.confirmUpload(
						makeConfirmUploadCommand({
							documentId: doc.id,
							uploadedBy: owner.id,
							storageKey: `s3://bucket/list-ver/v${i + 1}.pdf`,
							checksum: `${"e".repeat(63)}${i}`,
						}),
					),
				);
			}

			const result = await expectEffectSuccess(
				ctx.uploadWorkflows.listVersions(makeListVersionsQuery(doc.id)),
			);

			expect(result.data.length).toBe(3);
			expect(result.pageNum).toBe(1);
		});
	});

	// ─── Get Latest Version ───────────────────────────────────────────────────

	describe("getLatestVersion", () => {
		it("should return the latest version after multiple uploads", async () => {
			const { owner, doc } = await seedOwnerAndDocument("latest-ver");
			await expectEffectSuccess(
				ctx.uploadWorkflows.confirmUpload(
					makeConfirmUploadCommand({
						documentId: doc.id,
						uploadedBy: owner.id,
						storageKey: "s3://bucket/latest/v1.pdf",
						checksum: "f".repeat(64),
					}),
				),
			);
			const v2 = await expectEffectSuccess(
				ctx.uploadWorkflows.confirmUpload(
					makeConfirmUploadCommand({
						documentId: doc.id,
						uploadedBy: owner.id,
						storageKey: "s3://bucket/latest/v2.pdf",
						checksum: "0".repeat(64),
					}),
				),
			);

			const latest = await expectEffectSuccess(
				ctx.uploadWorkflows.getLatestVersion(doc.id),
			);

			expect(latest.id).toBe(v2.id);
			expect(latest.versionNumber).toBe(2);
		});

		it("should fail when no versions exist", async () => {
			const { doc } = await seedOwnerAndDocument("no-ver");

			const err = await expectEffectFailure(
				ctx.uploadWorkflows.getLatestVersion(doc.id),
			);
			expect(err).toBeInstanceOf(DocumentVersionNotFoundError);
		});
	});

	// ─── Delete Version ───────────────────────────────────────────────────────

	describe("deleteVersion", () => {
		it("should delete a specific version", async () => {
			const { owner, doc } = await seedOwnerAndDocument("del-ver");
			const version = await expectEffectSuccess(
				ctx.uploadWorkflows.confirmUpload(
					makeConfirmUploadCommand({
						documentId: doc.id,
						uploadedBy: owner.id,
						storageKey: "s3://bucket/del-ver/v1.pdf",
						checksum: "1".repeat(64),
					}),
				),
			);

			const deleted = await expectEffectSuccess(
				ctx.uploadWorkflows.deleteVersion(version.id),
			);

			expect(deleted.id).toBe(version.id);
		});

		it("should fail when version does not exist", async () => {
			const err = await expectEffectFailure(
				ctx.uploadWorkflows.deleteVersion(crypto.randomUUID()),
			);
			expect(err).toBeInstanceOf(DocumentVersionNotFoundError);
		});
	});
});
