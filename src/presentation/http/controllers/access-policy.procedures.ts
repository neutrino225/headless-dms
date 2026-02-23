/**
 * oRPC procedures for access-policy operations.
 */

import {
	type CheckAccessDTO,
	CheckAccessDTOSchema,
	type GrantAccessDTO,
	GrantAccessDTOSchema,
	type RevokeAccessDTO,
	RevokeAccessDTOSchema,
	type UpdateAccessDTO,
	UpdateAccessDTOSchema,
} from "@application/dto/access-policy/access-policy.dto";
import type { CallerContext } from "@application/workflow/caller-context";
import type { AccessPolicyWorkflows } from "@application/workflow/documents/accessPolicy.workflow";
import type { Logger } from "@infra/logger/logger";
import type { AuthContext } from "../middleware/context";
import { runEffect } from "./effect-runner";
import { toAccessPolicyResponse } from "./response-mappers";
import { toStandard } from "./schema-adapter";
import type { ProcedureBuilderWithMiddleware } from "./types";

function callerFrom(ctx: AuthContext): CallerContext {
	return {
		userId: ctx.user.sub,
		role: ctx.user.role,
		workspaceId: ctx.user.workspaceId,
	};
}

export function createAccessPolicyProcedures(
	authBase: ProcedureBuilderWithMiddleware,
	workflows: AccessPolicyWorkflows,
	logger?: Logger,
) {
	const grantAccess = authBase
		.input(toStandard(GrantAccessDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: GrantAccessDTO;
				context: AuthContext;
			}) => {
				const policy = await runEffect(
					workflows.grantAccess(input, callerFrom(context)),
					logger,
				);
				return toAccessPolicyResponse(policy);
			},
		);

	const updateAccess = authBase
		.input(toStandard(UpdateAccessDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: UpdateAccessDTO;
				context: AuthContext;
			}) => {
				const policy = await runEffect(
					workflows.updateAccess(input, callerFrom(context)),
					logger,
				);
				return toAccessPolicyResponse(policy);
			},
		);

	const revokeAccess = authBase
		.input(toStandard(RevokeAccessDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: RevokeAccessDTO;
				context: AuthContext;
			}) => {
				const policy = await runEffect(
					workflows.revokeAccess(input, callerFrom(context)),
					logger,
				);
				return toAccessPolicyResponse(policy);
			},
		);

	const checkAccess = authBase
		.input(toStandard(CheckAccessDTOSchema))
		.handler(async ({ input }: { input: CheckAccessDTO }) => {
			try {
				await runEffect(workflows.checkAccess(input), logger);
				return { allowed: true as const };
			} catch {
				// checkAccess throws when denied; translate to a clean boolean response
				return { allowed: false as const };
			}
		});

	return {
		grant: grantAccess,
		update: updateAccess,
		revoke: revokeAccess,
		check: checkAccess,
	};
}
