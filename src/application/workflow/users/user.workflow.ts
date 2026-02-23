import "reflect-metadata";

import {
	type CreateUserDTOEncoded,
	CreateUserDTOSchema,
	type RemoveUserDTOEncoded,
	RemoveUserDTOSchema,
	type UpdateUserDTOEncoded,
	UpdateUserDTOSchema,
} from "@application/dto/user/user.dto";
import { WorkflowInfraError } from "@application/errors";
import type { CallerContext } from "@application/workflow/caller-context";
import {
	fromResult,
	mapInfraError,
	repoCall,
	unwrapOption,
} from "@application/workflow/workflow.utils";
import {
	AdminRequiredError,
	InsufficientPermissionsError,
} from "@domain/shared/authorization.errors";
import type { CreateEntity } from "@domain/shared/base.entity";
import { type IUser, User } from "@domain/user/user.entity";
import { UserRole } from "@domain/user/user.enums";
import {
	type EmailAlreadyTakenError,
	type UserAlreadyExistsError,
	UserNotFoundError,
	UserUnauthorizedError,
	UserValidationError,
} from "@domain/user/user.errors";
import type { UserRepository } from "@domain/user/user.repository";
import { Email, WorkspaceId } from "@domain/utils";
import { TOKENS } from "@infra/di/container/tokens";
import bcrypt from "bcryptjs";
import { Effect as E, Schema as S } from "effect";
import { inject, injectable } from "tsyringe";

type CreateUserError =
	| WorkflowInfraError
	| UserAlreadyExistsError
	| EmailAlreadyTakenError
	| UserValidationError
	| AdminRequiredError;
type UpdateUserError =
	| WorkflowInfraError
	| UserNotFoundError
	| InsufficientPermissionsError
	| UserValidationError;
type DeleteUserError =
	| WorkflowInfraError
	| UserNotFoundError
	| AdminRequiredError
	| UserValidationError;
type GetUserError = WorkflowInfraError | UserNotFoundError;
type AuthenticateUserError =
	| WorkflowInfraError
	| UserNotFoundError
	| UserUnauthorizedError;

@injectable()
export class UserWorkflows {
	constructor(
		@inject(TOKENS.UserRepository)
		private readonly userRepository: UserRepository,
	) {}

	createUser(
		input: CreateUserDTOEncoded,
		caller?: CallerContext,
	): E.Effect<User, CreateUserError> {
		return S.decodeUnknown(CreateUserDTOSchema)(input).pipe(
			E.mapError(
				(error) =>
					new UserValidationError("Validation failed", {
						details: String(error),
					}) as CreateUserError,
			),
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
					E.tryPromise({
						try: () => bcrypt.hash(dto.password, 10),
						catch: (cause) =>
							new Error(`Failed to hash password: ${String(cause)}`),
					}),
				]).pipe(
					E.mapError(
						(err) =>
							new UserValidationError(
								err instanceof Error ? err.message : String(err),
							) as CreateUserError,
					),
					E.map(
						([workspaceId, email, passwordHash]): CreateEntity<IUser> => ({
							workspaceId,
							email,
							role: dto.role,
							passwordHash,
							displayName: dto.displayName ?? null,
							isActive: dto.isActive,
						}),
					),
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
			mapInfraError("user.createUser"),
		);
	}

	updateUser(
		input: UpdateUserDTOEncoded,
		caller?: CallerContext,
	): E.Effect<User, UpdateUserError> {
		return S.decodeUnknown(UpdateUserDTOSchema)(input).pipe(
			E.mapError(
				() => new UserValidationError("Validation failed") as UpdateUserError,
			),
			E.tap((dto) => {
				if (!caller) return E.succeed(undefined);
				return this.requireAdminOrSelf(caller, dto.id, "updateUser");
			}),
			E.flatMap((dto) =>
				repoCall(() => this.userRepository.fetchById(dto.id)).pipe(
					E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(dto.id))),
					E.flatMap((existing) =>
						E.tryPromise({
							try: async () => {
								const serialized = existing.serialize();
								const passwordHash = dto.password
									? await bcrypt.hash(dto.password, 10)
									: serialized.passwordHash;

								return User.fromSerialized({
									...serialized,
									email: dto.email ?? serialized.email,
									role: dto.role ?? serialized.role,
									passwordHash,
									displayName: dto.displayName ?? serialized.displayName,
									isActive: dto.isActive ?? serialized.isActive,
									updatedAt: new Date().toISOString(),
								});
							},
							catch: (cause) =>
								new Error(`Failed to hash password: ${String(cause)}`),
						}),
					),
					E.flatMap((updated) =>
						repoCall(() => this.userRepository.update(updated)).pipe(
							E.flatMap((opt) =>
								unwrapOption(opt, new UserNotFoundError(dto.id)),
							),
						),
					),
				),
			),
			mapInfraError("user.updateUser"),
		);
	}

	deleteUser(
		input: RemoveUserDTOEncoded,
		caller?: CallerContext,
	): E.Effect<User, DeleteUserError> {
		return S.decodeUnknown(RemoveUserDTOSchema)(input).pipe(
			E.mapError(
				() => new UserValidationError("Validation failed") as DeleteUserError,
			),
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
			mapInfraError("user.deleteUser"),
		);
	}

	getUserById(id: string): E.Effect<User, GetUserError> {
		return repoCall(() => this.userRepository.fetchById(id)).pipe(
			E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(id))),
			mapInfraError("user.getUserById"),
		) as E.Effect<User, GetUserError>;
	}

	getUserByEmail(email: string): E.Effect<User, GetUserError> {
		return repoCall(() => this.userRepository.fetchByEmail(email)).pipe(
			E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(email))),
			mapInfraError("user.getUserByEmail"),
		) as E.Effect<User, GetUserError>;
	}

	authenticateUser(
		email: string,
		password: string,
	): E.Effect<User, AuthenticateUserError> {
		return repoCall(() => this.userRepository.fetchByEmail(email)).pipe(
			E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(email))),
			E.flatMap((user) => {
				if (!user.isActive) {
					return E.fail<AuthenticateUserError>(
						new UserUnauthorizedError("User account is inactive"),
					);
				}
				// Run bcrypt comparison as an Effect — no throws, no instanceof re-checks
				return E.tryPromise({
					try: () => bcrypt.compare(password, user.passwordHash),
					catch: (cause) =>
						new Error(`bcrypt comparison failed: ${String(cause)}`),
				}).pipe(
					E.flatMap((ok) =>
						ok
							? E.succeed(user)
							: E.fail<AuthenticateUserError>(
									new UserUnauthorizedError("Invalid credentials"),
								),
					),
				);
			}),
			mapInfraError("user.authenticateUser"),
		);
	}

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
