import "reflect-metadata";
import { DocumentStatus } from "@domain/document/document.enums";
import { DocumentNotFoundError } from "@domain/document/document.errors";
import { describeIntegration } from "@tests/utils/integration";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	makeChangeStatusCommand,
	makeCreateDocumentCommand,
	makeCreateUserCommand,
	makeListDocumentsQuery,
	makeUpdateDocumentCommand,
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

describeIntegration("DocumentWorkflows Integration Tests", () => {
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

	async function seedUser(overrides = {}) {
		const cmd = makeCreateUserCommand(overrides);
		return expectEffectSuccess(ctx.userWorkflows.createUser(cmd));
	}

	// ─── Create Document ──────────────────────────────────────────────────────

	describe("createDocument", () => {
		it("should create a document with valid input", async () => {
			const owner = await seedUser();
			const cmd = makeCreateDocumentCommand(owner.id, {
				name: "Annual Report",
				slug: "annual-report",
			});

			const doc = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(cmd),
			);

			expect(doc.name).toBe("Annual Report");
			expect(doc.slug).toBe("annual-report");
			expect(doc.status).toBe(DocumentStatus.Active);
			expect(doc.ownerId).toBe(owner.id);
		});

		it("should fail with invalid ownerId", async () => {
			const cmd = makeCreateDocumentCommand("not-a-uuid", {
				slug: "test-slug",
			});

			const err = await expectEffectFailure(
				ctx.documentWorkflows.createDocument(cmd),
			);
			expect(err).toBeInstanceOf(Error);
		});

		it("should persist the document and be retrievable by ID", async () => {
			const owner = await seedUser();
			const cmd = makeCreateDocumentCommand(owner.id, {
				slug: "retrieve-test",
			});

			const created = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(cmd),
			);
			const fetched = await expectEffectSuccess(
				ctx.documentWorkflows.getDocumentById(created.id),
			);

			expect(fetched.id).toBe(created.id);
			expect(fetched.name).toBe(created.name);
		});
	});

	// ─── Update Document ──────────────────────────────────────────────────────

	describe("updateDocument", () => {
		it("should update document fields", async () => {
			const owner = await seedUser();
			const cmd = makeCreateDocumentCommand(owner.id, {
				name: "Draft",
				slug: "draft-doc",
			});
			const created = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(cmd),
			);

			const updated = await expectEffectSuccess(
				ctx.documentWorkflows.updateDocument(
					makeUpdateDocumentCommand({ id: created.id, name: "Final Report" }),
				),
			);

			expect(updated.name).toBe("Final Report");
			expect(updated.slug).toBe(created.slug); // unchanged field preserved
		});

		it("should fail when document does not exist", async () => {
			const err = await expectEffectFailure(
				ctx.documentWorkflows.updateDocument(
					makeUpdateDocumentCommand({ id: crypto.randomUUID(), name: "Ghost" }),
				),
			);
			expect(err).toBeInstanceOf(DocumentNotFoundError);
		});
	});

	// ─── Change Status ────────────────────────────────────────────────────────

	describe("changeDocumentStatus", () => {
		it("should archive a document", async () => {
			const owner = await seedUser();
			const cmd = makeCreateDocumentCommand(owner.id, { slug: "archive-me" });
			const doc = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(cmd),
			);

			const archived = await expectEffectSuccess(
				ctx.documentWorkflows.changeDocumentStatus(
					makeChangeStatusCommand(doc.id, DocumentStatus.Archived),
				),
			);

			expect(archived.status).toBe(DocumentStatus.Archived);
		});

		it("should transition from Archived → Active (restore)", async () => {
			const owner = await seedUser();
			const cmd = makeCreateDocumentCommand(owner.id, { slug: "restore-me" });
			const doc = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(cmd),
			);

			await expectEffectSuccess(
				ctx.documentWorkflows.changeDocumentStatus(
					makeChangeStatusCommand(doc.id, DocumentStatus.Archived),
				),
			);

			const restored = await expectEffectSuccess(
				ctx.documentWorkflows.changeDocumentStatus(
					makeChangeStatusCommand(doc.id, DocumentStatus.Active),
				),
			);

			expect(restored.status).toBe(DocumentStatus.Active);
		});
	});

	// ─── Delete Document ──────────────────────────────────────────────────────

	describe("deleteDocument", () => {
		it("should delete a document and return it", async () => {
			const owner = await seedUser();
			const cmd = makeCreateDocumentCommand(owner.id, { slug: "delete-me" });
			const doc = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(cmd),
			);

			const deleted = await expectEffectSuccess(
				ctx.documentWorkflows.deleteDocument({ id: doc.id }),
			);

			expect(deleted.id).toBe(doc.id);
		});

		it("should fail when deleting non-existent document", async () => {
			const err = await expectEffectFailure(
				ctx.documentWorkflows.deleteDocument({ id: crypto.randomUUID() }),
			);
			expect(err).toBeInstanceOf(DocumentNotFoundError);
		});
	});

	// ─── Queries ──────────────────────────────────────────────────────────────

	describe("getDocumentById", () => {
		it("should return the document for a valid ID", async () => {
			const owner = await seedUser();
			const cmd = makeCreateDocumentCommand(owner.id, { slug: "by-id-q" });
			const created = await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(cmd),
			);

			const result = await expectEffectSuccess(
				ctx.documentWorkflows.getDocumentById(created.id),
			);
			expect(result.id).toBe(created.id);
		});

		it("should fail for unknown ID", async () => {
			const err = await expectEffectFailure(
				ctx.documentWorkflows.getDocumentById(crypto.randomUUID()),
			);
			expect(err).toBeInstanceOf(DocumentNotFoundError);
		});
	});

	describe("getDocumentBySlug", () => {
		it("should return the document for a valid slug", async () => {
			const owner = await seedUser();
			const cmd = makeCreateDocumentCommand(owner.id, {
				slug: "unique-slug-test",
			});
			await expectEffectSuccess(ctx.documentWorkflows.createDocument(cmd));

			const result = await expectEffectSuccess(
				ctx.documentWorkflows.getDocumentBySlug("unique-slug-test"),
			);
			expect(result.slug).toBe("unique-slug-test");
		});
	});

	describe("listDocuments", () => {
		it("should list documents with pagination", async () => {
			const owner = await seedUser();
			for (let i = 0; i < 3; i++) {
				const cmd = makeCreateDocumentCommand(owner.id, {
					slug: `list-doc-${i}`,
				});
				await expectEffectSuccess(ctx.documentWorkflows.createDocument(cmd));
			}

			const result = await expectEffectSuccess(
				ctx.documentWorkflows.listDocuments(
					makeListDocumentsQuery({ pageSize: 2, pageNum: 1 }),
				),
			);

			expect(result.data.length).toBe(2);
			expect(result.totalPages).toBe(2);
			expect(result.pageNum).toBe(1);
		});

		it("should filter documents by ownerId", async () => {
			const owner1 = await seedUser({ email: "owner1@test.com" });
			const owner2 = await seedUser({ email: "owner2@test.com" });

			await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(
					makeCreateDocumentCommand(owner1.id, { slug: "o1-doc" }),
				),
			);
			await expectEffectSuccess(
				ctx.documentWorkflows.createDocument(
					makeCreateDocumentCommand(owner2.id, { slug: "o2-doc" }),
				),
			);

			const result = await expectEffectSuccess(
				ctx.documentWorkflows.listDocuments(
					makeListDocumentsQuery({ ownerId: owner1.id }),
				),
			);

			expect(result.data.length).toBe(1);
			expect(result.data[0]?.ownerId).toBe(owner1.id);
		});
	});
});
