import "reflect-metadata";

import { Option } from "@carbonteq/fp";
import { fromResult, unwrapOption, repoCall } from "@application/workflow/workflow.utils";
import {
    InitiateUploadDTOEncoded,
    InitiateUploadDTOSchema,
    ConfirmUploadDTOEncoded,
    ConfirmUploadDTOSchema,
    ListDocumentVersionsDTOEncoded,
    ListDocumentVersionsDTOSchema,
} from "@application/dto/document/document.dto";
import { Document } from "@domain/document/document.entity";
import { DocumentVersion, IDocumentVersion } from "@domain/document/document-version.entity";
import {
    DocumentNotFoundError,
    DocumentVersionNotFoundError,
} from "@domain/document/document.errors";
import { DocumentRepository } from "@domain/document/document.repository";
import { DocumentVersionRepository } from "@domain/document/document-version.repository";
import { AuditLog, IAuditLog, AuditResourceType } from "@domain/audit-log/audit-log.entity";
import { AuditAction } from "@domain/audit-log/audit-log.enums";
import { AuditLogRepository } from "@domain/audit-log/audit-log.repository";
import {
    DocumentId,
    UserId,
    MimeType,
    StorageKey,
    Checksum,
    DocumentVersionId,
    UUID,
} from "@domain/utils";
import { CreateEntity } from "@domain/shared/base.entity";
import { PaginationOptions, Paginated } from "@domain/shared/pagination";
import { TOKENS } from "@infra/di/container/tokens";
import { inject, injectable } from "tsyringe";
import { Effect as E, pipe, Schema as S } from "effect";

type UploadWorkflowError =
    | Error
    | DocumentNotFoundError
    | DocumentVersionNotFoundError;

export interface UploadInitiation {
    readonly documentId: string;
    readonly uploadUrl: string;
    readonly expiresAt: Date;
}

@injectable()
export class UploadWorkflows {
    constructor(
        @inject(TOKENS.DocumentRepository)
        private readonly documentRepository: DocumentRepository,
        @inject(TOKENS.DocumentVersionRepository)
        private readonly documentVersionRepository: DocumentVersionRepository,
        @inject(TOKENS.AuditLogRepository)
        private readonly auditLogRepository: AuditLogRepository,
    ) {}

    /**
     * Initiate an upload: validates the document exists and returns a pre-signed URL placeholder.
     * Actual URL generation would be delegated to a storage service in infra.
     */
    initiateUpload(
        input: InitiateUploadDTOEncoded,
    ): E.Effect<UploadInitiation, UploadWorkflowError> {
        return pipe(
            S.decodeUnknown(InitiateUploadDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    // Verify document exists
                    repoCall(() =>
                        this.documentRepository.fetchById(dto.documentId),
                    ),
                    E.flatMap((opt) =>
                        unwrapOption(
                            opt,
                            new DocumentNotFoundError(dto.documentId),
                        ),
                    ),
                    E.map(
                        (doc): UploadInitiation => ({
                            documentId: doc.id,
                            uploadUrl: `https://storage.example.com/upload/${doc.id}/${Date.now()}`,
                            expiresAt: new Date(
                                Date.now() + 60 * 60 * 1000,
                            ), // 1 hour
                        }),
                    ),
                ),
            ),
        );
    }

    /**
     * Confirm an upload: creates a new document version and updates the document's latest version.
     * Idempotent on checksum + storageKey uniqueness.
     */
    confirmUpload(
        input: ConfirmUploadDTOEncoded,
    ): E.Effect<DocumentVersion, UploadWorkflowError> {
        return pipe(
            S.decodeUnknown(ConfirmUploadDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    // Idempotency: if a version with this storageKey was already confirmed, return it.
                    repoCall(() =>
                        this.documentVersionRepository.fetchByStorageKey(dto.storageKey),
                    ),
                    E.flatMap((maybeExisting) => {
                        if (maybeExisting.isSome()) {
                            return E.succeed(maybeExisting.unwrap()) as E.Effect<DocumentVersion, UploadWorkflowError>;
                        }
                        // No existing version — run the full create flow.
                        return pipe(
                            // Verify document exists
                            repoCall(() =>
                                this.documentRepository.fetchById(dto.documentId),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(opt, new DocumentNotFoundError(dto.documentId)),
                            ),
                            E.flatMap((doc) =>
                                pipe(
                                    // Determine next version number from latest
                                    repoCall(() =>
                                        this.documentVersionRepository.fetchLatestByDocumentId(
                                            dto.documentId,
                                        ),
                                    ),
                                    E.map((maybeLatest) =>
                                        maybeLatest.isSome()
                                            ? maybeLatest.unwrap().versionNumber + 1
                                            : 1,
                                    ),
                                    E.flatMap((versionNumber) =>
                                        E.all([
                                            fromResult(DocumentId.create(dto.documentId)),
                                            fromResult(UserId.create(dto.uploadedBy)),
                                            fromResult(MimeType.create(dto.mimeType)),
                                            fromResult(StorageKey.create(dto.storageKey)),
                                            fromResult(Checksum.create(dto.checksum)),
                                            E.succeed(versionNumber),
                                        ]),
                                    ),
                                    E.flatMap(([documentId, uploadedBy, mimeType, storageKey, checksum, versionNumber]) => {
                                        const data: CreateEntity<IDocumentVersion> = {
                                            documentId,
                                            versionNumber,
                                            storageKey,
                                            mimeType,
                                            sizeBytes: dto.sizeBytes,
                                            checksum,
                                            uploadedBy,
                                        };
                                        return fromResult(DocumentVersion.create(data));
                                    }),
                                    // Insert version
                                    E.flatMap((version) =>
                                        repoCall(() =>
                                            this.documentVersionRepository.insert(version),
                                        ).pipe(
                                            E.flatMap((opt) =>
                                                unwrapOption(opt, new Error("Insert returned no version")),
                                            ),
                                        ),
                                    ),
                                    // Update document's latestVersionId
                                    E.tap((version) => {
                                        const serialized = doc.serialize();
                                        const updated = Document.fromSerialized({
                                            ...serialized,
                                            latestVersionId: version.id,
                                            updatedAt: new Date().toISOString(),
                                        });
                                        return repoCall(() => this.documentRepository.update(updated));
                                    }),
                                    // Audit log
                                    E.tap((version) =>
                                        this.logAudit(
                                            dto.uploadedBy,
                                            AuditAction.VERSION_UPLOADED,
                                            version.id,
                                            "document",
                                        ),
                                    ),
                                ),
                            ),
                        );
                    }),
                ),
            ),
        );
    }

    /**
     * List all versions for a document with pagination.
     */
    listVersions(
        input: ListDocumentVersionsDTOEncoded,
    ): E.Effect<Paginated<DocumentVersion>, UploadWorkflowError> {
        return pipe(
            S.decodeUnknown(ListDocumentVersionsDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    fromResult(
                        PaginationOptions.create({
                            pageNum: dto.pageNum ?? 1,
                            pageSize: dto.pageSize ?? 100,
                        }),
                    ),
                    E.flatMap((paginationOpts) =>
                        repoCall(() =>
                            this.documentVersionRepository.fetchByDocumentId(
                                dto.documentId,
                                paginationOpts,
                            ),
                        ),
                    ),
                ),
            ),
        );
    }

    /**
     * Get latest version for a document.
     */
    getLatestVersion(
        documentId: string,
    ): E.Effect<DocumentVersion, UploadWorkflowError> {
        return pipe(
            repoCall(() =>
                this.documentVersionRepository.fetchLatestByDocumentId(
                    documentId,
                ),
            ),
            E.flatMap((opt) =>
                unwrapOption(
                    opt,
                    new DocumentVersionNotFoundError(documentId),
                ),
            ),
        );
    }

    /**
     * Delete a specific version.
     */
    deleteVersion(
        versionId: string,
    ): E.Effect<DocumentVersion, UploadWorkflowError> {
        return pipe(
            repoCall(() =>
                this.documentVersionRepository.delete(versionId),
            ),
            E.flatMap((opt) =>
                unwrapOption(
                    opt,
                    new DocumentVersionNotFoundError(versionId),
                ),
            ),
            E.tap((version) =>
                this.logAudit(
                    UserId.toString(version.uploadedBy),
                    AuditAction.VERSION_DELETED,
                    version.id,
                    "document",
                ),
            ),
        );
    }

    private logAudit(
        userId: string,
        action: AuditAction,
        resourceId: string,
        resourceType: AuditResourceType,
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
                    metadata: null,
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
