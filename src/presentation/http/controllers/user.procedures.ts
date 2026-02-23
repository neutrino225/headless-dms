/**
 * oRPC procedures for user management.
 */

import {
	type CreateUserDTO,
	CreateUserDTOSchema,
	type RemoveUserDTO,
	RemoveUserDTOSchema,
	type UpdateUserDTO,
	UpdateUserDTOSchema,
} from "@application/dto/user/user.dto";
import type { CallerContext } from "@application/workflow/caller-context";
import type { UserWorkflows } from "@application/workflow/users/user.workflow";
import { Schema as S } from "effect";
import type { AuthContext } from "../middleware/context";
import { runEffect } from "./effect-runner";
import { toUserResponse } from "./response-mappers";
import { toStandard } from "./schema-adapter";
import type { ProcedureBuilderWithMiddleware } from "./types";

function callerFrom(ctx: AuthContext): CallerContext {
	return {
		userId: ctx.user.sub,
		role: ctx.user.role,
		workspaceId: ctx.user.workspaceId,
	};
}

export function createUserProcedures(
	authBase: ProcedureBuilderWithMiddleware,
	workflows: UserWorkflows,
) {
	const createUser = authBase
		.input(toStandard(CreateUserDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: CreateUserDTO;
				context: AuthContext;
			}) => {
				const user = await runEffect(
					workflows.createUser(input, callerFrom(context)),
				);
				return toUserResponse(user);
			},
		);

	const updateUser = authBase
		.input(toStandard(UpdateUserDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: UpdateUserDTO;
				context: AuthContext;
			}) => {
				const user = await runEffect(
					workflows.updateUser(input, callerFrom(context)),
				);
				return toUserResponse(user);
			},
		);

	const deleteUser = authBase
		.input(toStandard(RemoveUserDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: RemoveUserDTO;
				context: AuthContext;
			}) => {
				const user = await runEffect(
					workflows.deleteUser(input, callerFrom(context)),
				);
				return toUserResponse(user);
			},
		);

	const getById = authBase
		.input(toStandard(S.Struct({ id: S.String })))
		.handler(async ({ input }: { input: { id: string } }) => {
			const user = await runEffect(workflows.getUserById(input.id));
			return toUserResponse(user);
		});

	const getByEmail = authBase
		.input(toStandard(S.Struct({ email: S.String })))
		.handler(async ({ input }: { input: { email: string } }) => {
			const user = await runEffect(workflows.getUserByEmail(input.email));
			return toUserResponse(user);
		});

	return {
		create: createUser,
		update: updateUser,
		delete: deleteUser,
		getById,
		getByEmail,
	};
}
