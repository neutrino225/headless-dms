import {
	type AuthTokenResponseDTO,
	type LoginDTO,
	LoginDTOSchema,
} from "@application/dto/auth/auth.dto";
import type { UserWorkflows } from "@application/workflow/users/user.workflow";
import type { Logger } from "@infra/logger/logger";
import type { JwtPayload } from "@presentation/http/middleware/context";
import { Schema as S } from "effect";
import jwt from "jsonwebtoken";
import type { AuthContext } from "../middleware/context";
import { runEffect } from "./effect-runner";
import { toStandard } from "./schema-adapter";
import type { ProcedureBuilderWithMiddleware } from "./types";

export function createAuthProcedures(
	publicBase: ProcedureBuilderWithMiddleware,
	authBase: ProcedureBuilderWithMiddleware,
	workflows: UserWorkflows,
	jwtSecret: string,
	logger?: Logger,
) {
	const login = publicBase
		.input(toStandard(LoginDTOSchema))
		.handler(async ({ input }: { input: LoginDTO }) => {
			const user = await runEffect(
				workflows.authenticateUser(input.email, input.password),
				logger,
			);

			const payload: JwtPayload = {
				sub: user.id,
				email: user.email,
				role: user.role,
				workspaceId: user.workspaceId,
			};

			const expiresIn = 60 * 60;
			const token = jwt.sign(payload, jwtSecret, { expiresIn });

			const response: AuthTokenResponseDTO = {
				token,
				expiresIn,
				user: {
					id: user.id,
					workspaceId: user.workspaceId,
					email: user.email,
					role: user.role,
				},
			};

			return response;
		});

	const me = authBase
		.input(toStandard(S.Struct({})))
		.handler(async ({ context }: { context: AuthContext }) => {
			const user = await runEffect(
				workflows.getUserById(context.user.sub),
				logger,
			);
			return {
				id: user.id,
				workspaceId: user.workspaceId,
				email: user.email,
				role: user.role,
				isActive: user.isActive,
			};
		});

	return {
		login,
		me,
	};
}
