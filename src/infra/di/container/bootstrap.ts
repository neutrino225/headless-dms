/**
 * DI container bootstrap.
 *
 * Registers all repository implementations against their TOKENS,
 * then resolves the workflow classes (which use @inject decorators).
 *
 * We use tsyringe's manual registration since the repository impls
 * take a `db` instance in their constructor (not injected via token).
 */

import "reflect-metadata";

import { AccessPolicyWorkflows } from "@application/workflow/documents/accessPolicy.workflow";
import { DocumentWorkflows } from "@application/workflow/documents/document.workflow";
import { UploadWorkflows } from "@application/workflow/documents/upload.workflow";
import { UserWorkflows } from "@application/workflow/users/user.workflow";
import type { AppConfig } from "@infra/config/env";
import type { DB } from "@infra/db/db";
import { AccessPolicyRepositoryImpl } from "@infra/repositories/access-policy.repository.impl";
import { AuditLogRepositoryImpl } from "@infra/repositories/audit-log.repository.impl";
import { DocumentRepositoryImpl } from "@infra/repositories/document.repository.impl";
import { UserRepositoryImpl } from "@infra/repositories/user.repository.impl";
import { MinioObjectStorageService } from "@infra/services/minio-object-storage.service";
import { container } from "tsyringe";
import { TOKENS } from "./tokens";

export interface ResolvedWorkflows {
	documentWorkflows: DocumentWorkflows;
	uploadWorkflows: UploadWorkflows;
	accessPolicyWorkflows: AccessPolicyWorkflows;
	userWorkflows: UserWorkflows;
}

/**
 * Bootstrap the DI container and resolve all workflow instances.
 */
export function bootstrapContainer(db: DB, config: AppConfig): ResolvedWorkflows {
	// Register repository implementations as singletons
	container.register(TOKENS.DocumentRepository, {
		useValue: new DocumentRepositoryImpl(db),
	});
	container.register(TOKENS.UserRepository, {
		useValue: new UserRepositoryImpl(db),
	});
	container.register(TOKENS.AccessPolicyRepository, {
		useValue: new AccessPolicyRepositoryImpl(db),
	});
	container.register(TOKENS.AuditLogRepository, {
		useValue: new AuditLogRepositoryImpl(db),
	});
	container.register(TOKENS.ObjectStorage, {
		useValue: new MinioObjectStorageService(config.objectStorage),
	});

	// Resolve workflow classes — tsyringe injects the registered tokens
	return {
		documentWorkflows: container.resolve(DocumentWorkflows),
		uploadWorkflows: container.resolve(UploadWorkflows),
		accessPolicyWorkflows: container.resolve(AccessPolicyWorkflows),
		userWorkflows: container.resolve(UserWorkflows),
	};
}
