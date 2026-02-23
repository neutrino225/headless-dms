import "reflect-metadata";
import { UserRole } from "@domain/user/user.enums";
import { UserNotFoundError } from "@domain/user/user.errors";
import { describeIntegration } from "@tests/utils/integration";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	makeCreateAdminCommand,
	makeCreateUserCommand,
	makeUpdateUserCommand,
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

describeIntegration("UserWorkflows Integration Tests", () => {
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

	// ─── Create User ──────────────────────────────────────────────────────────

	describe("createUser", () => {
		it("should create a user with valid input", async () => {
			const cmd = makeCreateUserCommand({
				email: "alice@example.com",
				displayName: "Alice",
			});

			const user = await expectEffectSuccess(ctx.userWorkflows.createUser(cmd));

			expect(user.email).toBe("alice@example.com");
			expect(user.role).toBe(UserRole.USER);
			expect(user.isActive).toBe(true);
		});

		it("should create an admin user", async () => {
			const cmd = makeCreateAdminCommand({ email: "admin@example.com" });

			const user = await expectEffectSuccess(ctx.userWorkflows.createUser(cmd));

			expect(user.role).toBe(UserRole.ADMIN);
		});

		it("should persist the user and be retrievable by email", async () => {
			const cmd = makeCreateUserCommand({ email: "bob@example.com" });
			await expectEffectSuccess(ctx.userWorkflows.createUser(cmd));

			const fetched = await expectEffectSuccess(
				ctx.userWorkflows.getUserByEmail("bob@example.com"),
			);

			expect(fetched.email).toBe("bob@example.com");
		});
	});

	// ─── Update User ──────────────────────────────────────────────────────────

	describe("updateUser", () => {
		it("should update user display name", async () => {
			const user = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({
						email: "update@example.com",
						displayName: "Old Name",
					}),
				),
			);

			const updated = await expectEffectSuccess(
				ctx.userWorkflows.updateUser(
					makeUpdateUserCommand({ id: user.id, displayName: "New Name" }),
				),
			);

			expect(updated.displayName).toBe("New Name");
			expect(updated.email).toBe("update@example.com"); // unchanged
		});

		it("should deactivate a user", async () => {
			const user = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({ email: "deactivate@example.com" }),
				),
			);

			const updated = await expectEffectSuccess(
				ctx.userWorkflows.updateUser(
					makeUpdateUserCommand({ id: user.id, isActive: false }),
				),
			);

			expect(updated.isActive).toBe(false);
		});

		it("should fail when user does not exist", async () => {
			const err = await expectEffectFailure(
				ctx.userWorkflows.updateUser(
					makeUpdateUserCommand({
						id: crypto.randomUUID(),
						displayName: "Ghost",
					}),
				),
			);
			expect(err).toBeInstanceOf(UserNotFoundError);
		});
	});

	// ─── Delete User ──────────────────────────────────────────────────────────

	describe("deleteUser", () => {
		it("should delete a user and return the deleted entity", async () => {
			const user = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({ email: "delete@example.com" }),
				),
			);

			const deleted = await expectEffectSuccess(
				ctx.userWorkflows.deleteUser({ id: user.id }),
			);

			expect(deleted.id).toBe(user.id);
		});

		it("should fail when deleting non-existent user", async () => {
			const err = await expectEffectFailure(
				ctx.userWorkflows.deleteUser({ id: crypto.randomUUID() }),
			);
			expect(err).toBeInstanceOf(UserNotFoundError);
		});
	});

	// ─── Get User ─────────────────────────────────────────────────────────────

	describe("getUserById", () => {
		it("should return a user by ID", async () => {
			const user = await expectEffectSuccess(
				ctx.userWorkflows.createUser(
					makeCreateUserCommand({ email: "getme@example.com" }),
				),
			);

			const result = await expectEffectSuccess(
				ctx.userWorkflows.getUserById(user.id),
			);
			expect(result.id).toBe(user.id);
		});

		it("should fail for unknown ID", async () => {
			const err = await expectEffectFailure(
				ctx.userWorkflows.getUserById(crypto.randomUUID()),
			);
			expect(err).toBeInstanceOf(UserNotFoundError);
		});
	});

	describe("getUserByEmail", () => {
		it("should return a user by email", async () => {
			const cmd = makeCreateUserCommand({ email: "findme@example.com" });
			const created = await expectEffectSuccess(
				ctx.userWorkflows.createUser(cmd),
			);

			const result = await expectEffectSuccess(
				ctx.userWorkflows.getUserByEmail("findme@example.com"),
			);
			expect(result.id).toBe(created.id);
		});

		it("should fail for unknown email", async () => {
			const err = await expectEffectFailure(
				ctx.userWorkflows.getUserByEmail("nonexistent@example.com"),
			);
			expect(err).toBeInstanceOf(UserNotFoundError);
		});
	});
});
