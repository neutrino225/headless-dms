import "reflect-metadata";

import {
	type CheckAccessDTOEncoded,
	CheckAccessDTOSchema,
	type GrantAccessDTOEncoded,
	GrantAccessDTOSchema,
	type RevokeAccessDTOEncoded,
	RevokeAccessDTOSchema,
	type UpdateAccessDTOEncoded,
	UpdateAccessDTOSchema,
} from "@application/dto/access-policy/access-policy.dto";
import type { CallerContext } from "@application/workflow/caller-context";
import { WorkflowInfraError } from "@application/errors";
import {
	fromResult,
	mapInfraError,
	repoCall,
	unwrapOption,
} from "@application/workflow/workflow.utils";
import {
	AccessPolicy,
	type IAccessPolicy,
} from "@domain/access-policy/access-policy.entity";
import {
	AccessPolicyNotFoundError,
	AccessPolicyValidationError,
} from "@domain/access-policy/access-policy.errors";
import {
	DocumentAccessDeniedError,
	NoAccessPolicyError,
} from "@domain/services/document-access.errors";
import type { AccessPolicyRepository } from "@domain/access-policy/access-policy.repository";
import {
	AuditLog,
	type AuditResourceType,
	type IAuditLog,
} from "@domain/audit-log/audit-log.entity";
import { AuditAction } from "@domain/audit-log/audit-log.enums";
import type { AuditLogRepository } from "@domain/audit-log/audit-log.repository";
import { DocumentNotFoundError } from "@domain/document/document.errors";
import { isOwner } from "@domain/document/document.guards";
import type { DocumentRepository } from "@domain/document/document.repository";
import { canAccess } from "@domain/services/document-access.service";
import { InsufficientPermissionsError } from "@domain/shared/authorization.errors";
import type { CreateEntity } from "@domain/shared/base.entity";
import { UserRole } from "@domain/user/user.enums";
import { UserNotFoundError } from "@domain/user/user.errors";
import type { UserRepository } from "@domain/user/user.repository";
import { DocumentId, UserId, UUID } from "@domain/utils";
import { TOKENS } from "@infra/di/container/tokens";
import { Effect as E, pipe, Schema as S } from "effect";
import { inject, injectable } from "tsyringe";

type AccessPolicyWorkflowError =
	| WorkflowInfraError
	| AccessPolicyNotFoundError
	| AccessPolicyValidationError
	| DocumentAccessDeniedError
	| NoAccessPolicyError
	| DocumentNotFoundError
	| UserNotFoundError
	| InsufficientPermissionsError;

@injectable()
export class AccessPolicyWorkflows {
	constructor(
		@inject(TOKENS.AccessPolicyRepository)
		private readonly accessPolicyRepository: AccessPolicyRepository,
		@inject(TOKENS.DocumentRepository)
		private readonly documentRepository: DocumentRepository,
		@inject(TOKENS.UserRepository)
		private readonly userRepository: UserRepository,
		@inject(TOKENS.AuditLogRepository)
		private readonly auditLogRepository: AuditLogRepository,
	) {}

	// ── Mutations (require CallerContext for authz + audit) ────────────────

	/**
	 * Grant access to a user for a document.
	 * Caller must be the document owner or an admin.
	 */
	grantAccess(
		input: GrantAccessDTOEncoded,
		caller?: CallerContext,
	): E.Effect<AccessPolicy, AccessPolicyWorkflowError> {
		return pipe(
			S.decodeUnknown(GrantAccessDTOSchema)(input),
			E.mapError(
				() =>
					new AccessPolicyValidationError(
						"Validation failed",
					) as AccessPolicyWorkflowError,
			),
			E.flatMap((dto) =>
				pipe(
					// Verify document and user both exist + auth check on document
					E.all([
						pipe(
							repoCall(() => this.documentRepository.fetchById(dto.documentId)),
							E.flatMap((opt) =>
								unwrapOption(opt, new DocumentNotFoundError(dto.documentId)),
							),
							E.flatMap((doc) => {
								return pipe(
									this.resolveCaller(caller, doc.ownerId),
									E.flatMap((effectiveCaller) =>
										pipe(
											this.requireDocOwnerOrAdmin(
												doc,
												effectiveCaller,
												"grantAccess",
											),
											E.as({ doc, effectiveCaller }),
										),
									),
								);
							}),
						),
						pipe(
							repoCall(() => this.userRepository.fetchById(dto.userId)),
							E.flatMap((opt) =>
								unwrapOption(opt, new UserNotFoundError(dto.userId)),
							),
						),
					]),
					E.flatMap(([docAndCaller, _user]) =>
						pipe(
							E.all([
								fromResult(DocumentId.create(dto.documentId)),
								fromResult(UserId.create(dto.userId)),
							]),
							E.flatMap(([documentId, userId]) => {
								const data: CreateEntity<IAccessPolicy> = {
									documentId,
									userId,
									accessLevel: dto.accessLevel,
								};
								return fromResult(AccessPolicy.create(data));
							}),
							E.flatMap((policy) =>
								pipe(
									repoCall(() => this.accessPolicyRepository.insert(policy)),
									E.flatMap((opt) =>
										unwrapOption(opt, new Error("Insert returned no policy")),
									),
								),
							),
							E.tap((policy) =>
								this.logAudit(
									docAndCaller.effectiveCaller.userId,
									AuditAction.ACCESS_GRANTED,
									policy.id,
									"policy",
									{
										documentId: dto.documentId,
										userId: dto.userId,
										accessLevel: dto.accessLevel,
									},
								),
							),
						),
					),
				),
			),
			mapInfraError("accessPolicy.grantAccess"),
		) as E.Effect<AccessPolicy, AccessPolicyWorkflowError>;
	}

	/**
	 * Update an existing access policy's level.
	 * Caller must be the document owner or an admin.
	 */
	updateAccess(
		input: UpdateAccessDTOEncoded,
		caller?: CallerContext,
	): E.Effect<AccessPolicy, AccessPolicyWorkflowError> {
		return pipe(
			S.decodeUnknown(UpdateAccessDTOSchema)(input),
			E.mapError(
				() =>
					new AccessPolicyValidationError(
						"Validation failed",
					) as AccessPolicyWorkflowError,
			),
			E.flatMap((dto) =>
				pipe(
					repoCall(() => this.accessPolicyRepository.fetchById(dto.policyId)),
					E.flatMap((opt) =>
						unwrapOption(
							opt,
							new AccessPolicyNotFoundError(dto.policyId, "unknown"),
						),
					),
					// Check caller owns the underlying document
					E.flatMap((existing) =>
						pipe(
							repoCall(() =>
								this.documentRepository.fetchById(
									DocumentId.toString(existing.documentId),
								),
							),
							E.flatMap((opt) =>
								unwrapOption(
									opt,
									new DocumentNotFoundError(
										DocumentId.toString(existing.documentId),
									),
								),
							),
							E.flatMap((doc) => {
								return pipe(
									this.resolveCaller(caller, doc.ownerId),
									E.flatMap((effectiveCaller) =>
										pipe(
											this.requireDocOwnerOrAdmin(
												doc,
												effectiveCaller,
												"updateAccess",
											),
											E.as({ existing, effectiveCaller }),
										),
									),
								);
							}),
						),
					),
					E.flatMap(({ existing, effectiveCaller }) => {
						const serialized = existing.serialize();
						const updated = AccessPolicy.fromSerialized({
							...serialized,
							accessLevel: dto.accessLevel,
							updatedAt: new Date().toISOString(),
						});

						return pipe(
							repoCall(() => this.accessPolicyRepository.update(updated)),
							E.flatMap((opt) =>
								unwrapOption(
									opt,
									new AccessPolicyNotFoundError(dto.policyId, "unknown"),
								),
							),
							E.tap((policy) =>
								this.logAudit(
									effectiveCaller.userId,
									AuditAction.ACCESS_UPDATED,
									policy.id,
									"policy",
									{
										newAccessLevel: dto.accessLevel,
									},
								),
							),
						);
					}),
				),
			),
			mapInfraError("accessPolicy.updateAccess"),
		) as E.Effect<AccessPolicy, AccessPolicyWorkflowError>;
	}

	/**
	 * Revoke access by deleting the policy.
	 * Caller must be the document owner or an admin.
	 */
	revokeAccess(
		input: RevokeAccessDTOEncoded,
		caller?: CallerContext,
	): E.Effect<AccessPolicy, AccessPolicyWorkflowError> {
		return pipe(
			S.decodeUnknown(RevokeAccessDTOSchema)(input),
			E.mapError(
				() =>
					new AccessPolicyValidationError(
						"Validation failed",
					) as AccessPolicyWorkflowError,
			),
			E.flatMap((dto) =>
				pipe(
					repoCall(() => this.accessPolicyRepository.delete(dto.policyId)),
					E.flatMap((opt) =>
						unwrapOption(
							opt,
							new AccessPolicyNotFoundError(dto.policyId, "unknown"),
						),
					),
					// Verify caller owns the underlying document
					E.flatMap((policy) =>
						pipe(
							repoCall(() =>
								this.documentRepository.fetchById(
									DocumentId.toString(policy.documentId),
								),
							),
							E.flatMap((opt) =>
								unwrapOption(
									opt,
									new DocumentNotFoundError(
										DocumentId.toString(policy.documentId),
									),
								),
							),
							E.flatMap((doc) => {
								return pipe(
									this.resolveCaller(caller, doc.ownerId),
									E.flatMap((effectiveCaller) =>
										pipe(
											this.requireDocOwnerOrAdmin(
												doc,
												effectiveCaller,
												"revokeAccess",
											),
											E.as({ policy, effectiveCaller }),
										),
									),
								);
							}),
						),
					),
					E.tap(({ policy, effectiveCaller }) =>
						this.logAudit(
							effectiveCaller.userId,
							AuditAction.ACCESS_REVOKED,
							policy.id,
							"policy",
							{
								documentId: DocumentId.toString(policy.documentId),
							},
						),
					),
					E.map(({ policy }) => policy),
				),
			),
			mapInfraError("accessPolicy.revokeAccess"),
		) as E.Effect<AccessPolicy, AccessPolicyWorkflowError>;
	}
	/**
	 * Check if a user has a given access level on a document.
	 * Uses the pure domain service `canAccess`.
	 */
	checkAccess(
		input: CheckAccessDTOEncoded,
	): E.Effect<void, AccessPolicyWorkflowError> {
		return pipe(
			S.decodeUnknown(CheckAccessDTOSchema)(input),
			E.mapError(
				() =>
					new AccessPolicyValidationError(
						"Validation failed",
					) as AccessPolicyWorkflowError,
			),
			E.flatMap((dto) =>
				pipe(
					E.all([
						pipe(
							repoCall(() => this.userRepository.fetchById(dto.userId)),
							E.flatMap((opt) =>
								unwrapOption(opt, new UserNotFoundError(dto.userId)),
							),
						),
						pipe(
							repoCall(() => this.documentRepository.fetchById(dto.documentId)),
							E.flatMap((opt) =>
								unwrapOption(opt, new DocumentNotFoundError(dto.documentId)),
							),
						),
						pipe(
							repoCall(() =>
								this.accessPolicyRepository.fetchByDocumentAndUser(
									dto.documentId,
									dto.userId,
								),
							),
							E.map((opt) => (opt.isSome() ? [opt.unwrap()] : [])),
						),
					]),
					E.flatMap(([user, document, policies]) =>
						fromResult(canAccess(user, document, policies, dto.action)),
					),
				),
			),
			mapInfraError("accessPolicy.checkAccess"),
		) as E.Effect<void, AccessPolicyWorkflowError>;
	}

	// ── Authorization ─────────────────────────────────────────────────────

	private requireDocOwnerOrAdmin(
		document: import("@domain/document/document.entity").Document,
		caller: CallerContext,
		action: string,
	): E.Effect<void, InsufficientPermissionsError> {
		if (caller.role === UserRole.ADMIN) return E.succeed(undefined);
		if (isOwner(document, UserId.fromTrusted(caller.userId)))
			return E.succeed(undefined);
		return E.fail(new InsufficientPermissionsError(action, document.id));
	}

	// ── Audit logging ─────────────────────────────────────────────────────

	private logAudit(
		userId: string,
		action: AuditAction,
		resourceId: string,
		resourceType: AuditResourceType,
		metadata?: Record<string, unknown>,
	): E.Effect<void, WorkflowInfraError> {
		return pipe(
			E.all([
				fromResult(UUID.create(userId)),
				fromResult(UUID.create(resourceId)),
			]),
			E.flatMap(([uid, rid]) => {
				const data: CreateEntity<IAuditLog> = {
					userId: uid,
					action,
					resourceId: rid,
					resourceType,
					metadata: metadata ?? null,
				};
				return fromResult(AuditLog.create(data));
			}),
			E.flatMap((log) => repoCall(() => this.auditLogRepository.insert(log))),
			E.map(() => undefined),
			mapInfraError("accessPolicy.logAudit"),
		) as E.Effect<void, WorkflowInfraError>;
	}

	private resolveCaller(
		caller: CallerContext | undefined,
		fallbackUserId: string,
	): E.Effect<CallerContext, WorkflowInfraError | UserNotFoundError> {
		if (caller) return E.succeed(caller);

		return pipe(
			repoCall(() => this.userRepository.fetchById(fallbackUserId)),
			E.flatMap((opt) =>
				unwrapOption(opt, new UserNotFoundError(fallbackUserId)),
			),
			E.map((user) => ({
				userId: user.id,
				role: user.role,
				workspaceId: user.workspaceId,
			})),
			mapInfraError("accessPolicy.resolveCaller"),
		) as E.Effect<CallerContext, WorkflowInfraError | UserNotFoundError>;
	}
}
