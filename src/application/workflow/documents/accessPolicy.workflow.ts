import "reflect-metadata";

import { Option } from "@carbonteq/fp";
import { fromResult, unwrapOption, repoCall } from "@application/workflow/workflow.utils";
import {
    GrantAccessDTOEncoded,
    GrantAccessDTOSchema,
    UpdateAccessDTOEncoded,
    UpdateAccessDTOSchema,
    RevokeAccessDTOEncoded,
    RevokeAccessDTOSchema,
    CheckAccessDTOEncoded,
    CheckAccessDTOSchema,
} from "@application/dto/access-policy/access-policy.dto";
import { AccessPolicy, IAccessPolicy } from "@domain/access-policy/access-policy.entity";
import {
    AccessPolicyNotFoundError,
    AccessDeniedError,
} from "@domain/access-policy/access-policy.errors";
import { AccessPolicyRepository } from "@domain/access-policy/access-policy.repository";
import { DocumentRepository } from "@domain/document/document.repository";
import { UserRepository } from "@domain/user/user.repository";
import { DocumentNotFoundError } from "@domain/document/document.errors";
import { UserNotFoundError } from "@domain/user/user.errors";
import { canAccess } from "@domain/services/document-access.service";
import { AuditLog, IAuditLog, AuditResourceType } from "@domain/audit-log/audit-log.entity";
import { AuditAction } from "@domain/audit-log/audit-log.enums";
import { AuditLogRepository } from "@domain/audit-log/audit-log.repository";
import { DocumentId, UserId, UUID } from "@domain/utils";
import { CreateEntity } from "@domain/shared/base.entity";
import { AccessLevel } from "@domain/document/document.enums";
import { TOKENS } from "@infra/di/container/tokens";
import { inject, injectable } from "tsyringe";
import { Effect as E, pipe, Schema as S } from "effect";

type AccessPolicyWorkflowError =
    | Error
    | AccessPolicyNotFoundError
    | AccessDeniedError
    | DocumentNotFoundError
    | UserNotFoundError;

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

    /**
     * Grant access to a user for a document.
     * Verifies both document and user exist before creating the policy.
     */
    grantAccess(
        input: GrantAccessDTOEncoded,
    ): E.Effect<AccessPolicy, AccessPolicyWorkflowError> {
        return pipe(
            S.decodeUnknown(GrantAccessDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    // Verify document and user both exist
                    E.all([
                        pipe(
                            repoCall(() =>
                                this.documentRepository.fetchById(
                                    dto.documentId,
                                ),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(
                                    opt,
                                    new DocumentNotFoundError(dto.documentId),
                                ),
                            ),
                        ),
                        pipe(
                            repoCall(() =>
                                this.userRepository.fetchById(dto.userId),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(
                                    opt,
                                    new UserNotFoundError(dto.userId),
                                ),
                            ),
                        ),
                    ]),
                    E.flatMap(([_doc, _user]) =>
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
                                    repoCall(() =>
                                        this.accessPolicyRepository.insert(
                                            policy,
                                        ),
                                    ),
                                    E.flatMap((opt) =>
                                        unwrapOption(
                                            opt,
                                            new Error(
                                                "Insert returned no policy",
                                            ),
                                        ),
                                    ),
                                ),
                            ),
                            E.tap((policy) =>
                                this.logAudit(
                                    dto.grantedBy,
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
        );
    }

    /**
     * Update an existing access policy's level.
     */
    updateAccess(
        input: UpdateAccessDTOEncoded,
    ): E.Effect<AccessPolicy, AccessPolicyWorkflowError> {
        return pipe(
            S.decodeUnknown(UpdateAccessDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    repoCall(() =>
                        this.accessPolicyRepository.fetchById(dto.policyId),
                    ),
                    E.flatMap((opt) =>
                        unwrapOption(
                            opt,
                            new AccessPolicyNotFoundError(
                                dto.policyId,
                                "unknown",
                            ),
                        ),
                    ),
                    E.flatMap((existing) => {
                        const serialized = existing.serialize();
                        const updated = AccessPolicy.fromSerialized({
                            ...serialized,
                            accessLevel: dto.accessLevel,
                            updatedAt: new Date().toISOString(),
                        });

                        return pipe(
                            repoCall(() =>
                                this.accessPolicyRepository.update(updated),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(
                                    opt,
                                    new AccessPolicyNotFoundError(
                                        dto.policyId,
                                        "unknown",
                                    ),
                                ),
                            ),
                            E.tap((policy) =>
                                this.logAudit(
                                    UserId.toString(policy.userId),
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
        );
    }

    /**
     * Revoke access by deleting the policy.
     */
    revokeAccess(
        input: RevokeAccessDTOEncoded,
    ): E.Effect<AccessPolicy, AccessPolicyWorkflowError> {
        return pipe(
            S.decodeUnknown(RevokeAccessDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    repoCall(() =>
                        this.accessPolicyRepository.delete(dto.policyId),
                    ),
                    E.flatMap((opt) =>
                        unwrapOption(
                            opt,
                            new AccessPolicyNotFoundError(
                                dto.policyId,
                                "unknown",
                            ),
                        ),
                    ),
                    E.tap((policy) =>
                        this.logAudit(
                            UserId.toString(policy.userId),
                            AuditAction.ACCESS_REVOKED,
                            policy.id,
                            "policy",
                            {
                                documentId: DocumentId.toString(
                                    policy.documentId,
                                ),
                            },
                        ),
                    ),
                ),
            ),
        );
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
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    E.all([
                        pipe(
                            repoCall(() =>
                                this.userRepository.fetchById(dto.userId),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(
                                    opt,
                                    new UserNotFoundError(dto.userId),
                                ),
                            ),
                        ),
                        pipe(
                            repoCall(() =>
                                this.documentRepository.fetchById(
                                    dto.documentId,
                                ),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(
                                    opt,
                                    new DocumentNotFoundError(dto.documentId),
                                ),
                            ),
                        ),
                        pipe(
                            repoCall(() =>
                                this.accessPolicyRepository.fetchByDocumentAndUser(
                                    dto.documentId,
                                    dto.userId,
                                ),
                            ),
                            E.map((opt) =>
                                opt.isSome() ? [opt.unwrap()] : [],
                            ),
                        ),
                    ]),
                    E.flatMap(([user, document, policies]) =>
                        fromResult(
                            canAccess(user, document, policies, dto.action),
                        ),
                    ),
                ),
            ),
        );
    }

    private logAudit(
        userId: string,
        action: AuditAction,
        resourceId: string,
        resourceType: AuditResourceType,
        metadata?: Record<string, unknown>,
    ): E.Effect<void, Error> {
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
            E.flatMap((log) =>
                repoCall(() => this.auditLogRepository.insert(log)),
            ),
            E.map(() => undefined),
        );
    }
}
