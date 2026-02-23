/**
 * Shared setup for workflow integration tests.
 *
 * Provides a reusable context that spins up a Testcontainer PostgreSQL database,
 * runs migrations, and instantiates all repository implementations and workflow classes.
 * Ensures test isolation via table truncation between tests.
 */

import { AccessPolicyWorkflows } from "@application/workflow/documents/accessPolicy.workflow";
import { DocumentWorkflows } from "@application/workflow/documents/document.workflow";
import { UploadWorkflows } from "@application/workflow/documents/upload.workflow";
import { UserWorkflows } from "@application/workflow/users/user.workflow";
import { AccessPolicyRepositoryImpl } from "@infra/repositories/access-policy.repository.impl";
import { AuditLogRepositoryImpl } from "@infra/repositories/audit-log.repository.impl";
import { DocumentRepositoryImpl } from "@infra/repositories/document.repository.impl";
import { UserRepositoryImpl } from "@infra/repositories/user.repository.impl";
import { MinioObjectStorageService } from "@infra/services/minio-object-storage.service";
import { TestDbContainer } from "@tests/infra/utils/test-db";
import { sql } from "drizzle-orm";

export interface WorkflowTestContext {
	testDb: TestDbContainer;
	// Repositories (for direct data seeding / verification)
	documentRepository: DocumentRepositoryImpl;
	userRepository: UserRepositoryImpl;
	accessPolicyRepository: AccessPolicyRepositoryImpl;
	auditLogRepository: AuditLogRepositoryImpl;
	// Workflows (under test)
	documentWorkflows: DocumentWorkflows;
	uploadWorkflows: UploadWorkflows;
	accessPolicyWorkflows: AccessPolicyWorkflows;
	userWorkflows: UserWorkflows;
}

/**
 * Create a full workflow test context backed by a real Testcontainer PostgreSQL.
 */
export async function createWorkflowTestContext(): Promise<WorkflowTestContext> {
	const testDb = new TestDbContainer();
	const { db } = await testDb.start();

	// Repositories
	const documentRepository = new DocumentRepositoryImpl(db);
	const userRepository = new UserRepositoryImpl(db);
	const accessPolicyRepository = new AccessPolicyRepositoryImpl(db);
	const auditLogRepository = new AuditLogRepositoryImpl(db);
	const objectStorage = new MinioObjectStorageService({
		endpoint: "http://127.0.0.1:9000",
		accessKeyId: "minioadmin",
		secretAccessKey: "minioadmin",
		bucket: "documents",
		region: "us-east-1",
		presignExpiresSec: 3600,
		forcePathStyle: true,
	});

	// Workflows — manually wired (bypassing DI container for test isolation)
	const documentWorkflows = new DocumentWorkflows(
		documentRepository as any,
		userRepository as any,
		auditLogRepository as any,
	);
	const uploadWorkflows = new UploadWorkflows(
		documentRepository as any,
		userRepository as any,
		auditLogRepository as any,
		objectStorage as any,
	);
	const accessPolicyWorkflows = new AccessPolicyWorkflows(
		accessPolicyRepository as any,
		documentRepository as any,
		userRepository as any,
		auditLogRepository as any,
	);
	const userWorkflows = new UserWorkflows(userRepository as any);

	return {
		testDb,
		documentRepository,
		userRepository,
		accessPolicyRepository,
		auditLogRepository,
		documentWorkflows,
		uploadWorkflows,
		accessPolicyWorkflows,
		userWorkflows,
	};
}

/**
 * Truncate all tables to ensure test isolation.
 */
export async function truncateAll(testDb: TestDbContainer): Promise<void> {
	await testDb.db.execute(
		sql`TRUNCATE TABLE audit_logs, access_policies, document_versions, documents, users CASCADE`,
	);
}
