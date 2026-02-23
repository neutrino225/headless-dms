/**
 * oRPC router — assembles all procedure groups into a single nested router object.
 *
 * In oRPC, a router is just a plain object whose leaves are procedures.
 */

import type { AccessPolicyWorkflows } from "@application/workflow/documents/accessPolicy.workflow";
import type { DocumentWorkflows } from "@application/workflow/documents/document.workflow";
import type { UploadWorkflows } from "@application/workflow/documents/upload.workflow";
import type { UserWorkflows } from "@application/workflow/users/user.workflow";
import type { Logger } from "@infra/logger/logger";
import { os } from "@orpc/server";
import { createAccessPolicyProcedures } from "../controllers/access-policy.procedures";
import { createAuthProcedures } from "../controllers/auth.procedures";
import { createDocumentProcedures } from "../controllers/document.procedures";
import { createUploadProcedures } from "../controllers/upload.procedures";
import { createUserProcedures } from "../controllers/user.procedures";
import { createAuthMiddleware } from "../middleware/auth.middleware";
import type { InitialContext } from "../middleware/context";

export interface RouterDependencies {
	jwtSecret: string;
	logger?: Logger;
	documentWorkflows: DocumentWorkflows;
	uploadWorkflows: UploadWorkflows;
	accessPolicyWorkflows: AccessPolicyWorkflows;
	userWorkflows: UserWorkflows;
}

export function createRouter(deps: RouterDependencies) {
	const authMiddleware = createAuthMiddleware(deps.jwtSecret, deps.logger);

	const publicBase = os.$context<InitialContext>();
	// Base builder: requires InitialContext (headers + correlationId), auth middleware adds `user`
	const authBase = os.$context<InitialContext>().use(authMiddleware);

	return {
		auth: createAuthProcedures(
			publicBase,
			authBase,
			deps.userWorkflows,
			deps.jwtSecret,
		),
		document: createDocumentProcedures(authBase, deps.documentWorkflows),
		upload: createUploadProcedures(authBase, deps.uploadWorkflows),
		accessPolicy: createAccessPolicyProcedures(
			authBase,
			deps.accessPolicyWorkflows,
		),
		user: createUserProcedures(authBase, deps.userWorkflows),
	};
}

export type AppRouter = ReturnType<typeof createRouter>;
