import "reflect-metadata";

import type { CallerContext } from "@application/workflow/caller-context";
import { User, IUser } from "@domain/user/user.entity";
import {
	EmailAlreadyTakenError,
	UserAlreadyExistsError,
	UserNotFoundError,
} from "@domain/user/user.errors";
import { UserRole } from "@domain/user/user.enums";
import { Email, WorkspaceId } from "@domain/utils";
import {
	AdminRequiredError,
	InsufficientPermissionsError,
} from "@domain/shared/authorization.errors";
import { TOKENS } from "@infra/di/container/tokens";
import { inject, injectable } from "tsyringe";
import type { UserRepository } from "@domain/user/user.repository";
import { Effect as E, Schema as S } from "effect";
import {
	CreateUserDTOEncoded,
	CreateUserDTOSchema,
	UpdateUserDTOEncoded,
	UpdateUserDTOSchema,
	RemoveUserDTOEncoded,
	RemoveUserDTOSchema,
} from "@application/dto/user/user.dto";
import {
	fromResult,
	unwrapOption,
	repoCall,
} from "@application/workflow/workflow.utils";
import { CreateEntity } from "@domain/shared/base.entity";

type CreateUserError =
	| Error
	| UserAlreadyExistsError
	| EmailAlreadyTakenError
	| AdminRequiredError;
type UpdateUserError = Error | UserNotFoundError | InsufficientPermissionsError;
type DeleteUserError = Error | UserNotFoundError | AdminRequiredError;
type GetUserError = Error | UserNotFoundError;

@injectable()
export class UserWorkflows {
	constructor(
		@inject(TOKENS.UserRepository)
		private readonly userRepository: UserRepository,
	) {}

	// ── Mutations (require CallerContext for authz) ────────────────────────

	/**
	 * Create a new user. Only admins may create users.
	 */
	createUser(
		input: CreateUserDTOEncoded,
		caller?: CallerContext,
	): E.Effect<User, CreateUserError> {
		return S.decodeUnknown(CreateUserDTOSchema)(input).pipe(
			E.mapError(() => new Error("Validation failed") as CreateUserError),
			E.tap(() => {
				if (caller && caller.role !== UserRole.ADMIN) {
					return E.fail(new AdminRequiredError("createUser"));
				}
				return E.succeed(undefined);
			}),
			E.flatMap((dto) =>
				E.all([
					fromResult(WorkspaceId.create(dto.workspaceId)),
					fromResult(Email.create(dto.email)),
				]).pipe(
					E.map(([workspaceId, email]): CreateEntity<IUser> => ({
						workspaceId,
						email,
						role: dto.role,
						passwordHash: dto.passwordHash,
						displayName: dto.displayName ?? null,
						isActive: dto.isActive,
					})),
					E.flatMap((data) => fromResult(User.create(data))),
					E.flatMap((user) =>
						repoCall(() => this.userRepository.insert(user)).pipe(
							E.flatMap((opt) =>
								unwrapOption(opt, new Error("Insert returned no user")),
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Update a user. Admins may update any user; regular users may only update themselves.
	 */
	updateUser(
		input: UpdateUserDTOEncoded,
		caller?: CallerContext,
	): E.Effect<User, UpdateUserError> {
		return S.decodeUnknown(UpdateUserDTOSchema)(input).pipe(
			E.mapError(() => new Error("Validation failed") as UpdateUserError),
			E.tap((dto) => {
				if (!caller) return E.succeed(undefined);
				return this.requireAdminOrSelf(caller, dto.id, "updateUser");
			}),
			E.flatMap((dto) =>
				repoCall(() => this.userRepository.fetchById(dto.id)).pipe(
					E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(dto.id))),
					E.map((existing) => {
						const serialized = existing.serialize();
						return User.fromSerialized({
							...serialized,
							email: dto.email ?? serialized.email,
							role: dto.role ?? serialized.role,
							passwordHash: dto.passwordHash ?? serialized.passwordHash,
							displayName: dto.displayName ?? serialized.displayName,
							isActive: dto.isActive ?? serialized.isActive,
							updatedAt: new Date().toISOString(),
						});
					}),
					E.flatMap((updated) =>
						repoCall(() => this.userRepository.update(updated)).pipe(
							E.flatMap((opt) =>
								unwrapOption(opt, new UserNotFoundError(dto.id)),
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Delete a user. Only admins may delete users.
	 */
	deleteUser(
		input: RemoveUserDTOEncoded,
		caller?: CallerContext,
	): E.Effect<User, DeleteUserError> {
		return S.decodeUnknown(RemoveUserDTOSchema)(input).pipe(
			E.mapError(() => new Error("Validation failed") as DeleteUserError),
			E.tap(() => {
				if (caller && caller.role !== UserRole.ADMIN) {
					return E.fail(new AdminRequiredError("deleteUser"));
				}
				return E.succeed(undefined);
			}),
			E.flatMap((dto) =>
				repoCall(() => this.userRepository.delete(dto.id)).pipe(
					E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(dto.id))),
				),
			),
		);
	}

	// ── Queries (no authz required — any authenticated user) ──────────────

	getUserById(id: string): E.Effect<User, GetUserError> {
		return repoCall(() => this.userRepository.fetchById(id)).pipe(
			E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(id))),
		);
	}

	getUserByEmail(email: string): E.Effect<User, GetUserError> {
		return repoCall(() => this.userRepository.fetchByEmail(email)).pipe(
			E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(email))),
		);
	}

	// ── Authorization ─────────────────────────────────────────────────────

	private requireAdminOrSelf(
		caller: CallerContext,
		targetUserId: string,
		action: string,
	): E.Effect<void, InsufficientPermissionsError> {
		if (caller.role === UserRole.ADMIN) return E.succeed(undefined);
		if (caller.userId === targetUserId) return E.succeed(undefined);
		return E.fail(new InsufficientPermissionsError(action, targetUserId));
	}
}
