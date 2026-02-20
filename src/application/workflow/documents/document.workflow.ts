import "reflect-metadata";

import { Option } from "@carbonteq/fp";
import {
    CreateDocumentDTOEncoded,
    CreateDocumentDTOSchema,
    UpdateDocumentDTOEncoded,
    UpdateDocumentDTOSchema,
    DeleteDocumentDTOEncoded,
    DeleteDocumentDTOSchema,
    ChangeDocumentStatusDTOEncoded,
    ChangeDocumentStatusDTOSchema,
    ListDocumentsDTOEncoded,
    ListDocumentsDTOSchema,
} from "@application/dto/document/document.dto";
import { Document, IDocument } from "@domain/document/document.entity";
import {
    DocumentNotFoundError,
    DocumentValidationError,
    DocumentArchivedError,
} from "@domain/document/document.errors";
import { DocumentStatus } from "@domain/document/document.enums";
import { DocumentRepository } from "@domain/document/document.repository";
import { AuditLog, IAuditLog, AuditResourceType } from "@domain/audit-log/audit-log.entity";
import { AuditAction } from "@domain/audit-log/audit-log.enums";
import { AuditLogRepository } from "@domain/audit-log/audit-log.repository";
import { UserId, MimeType, DocumentId, UUID } from "@domain/utils";
import { CreateEntity } from "@domain/shared/base.entity";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { TOKENS } from "@infra/di/container/tokens";
import { inject, injectable } from "tsyringe";
import { Effect as E, pipe, Schema as S } from "effect";
import { fromResult, unwrapOption, repoCall } from "@application/workflow/workflow.utils";

type DocumentWorkflowError =
    | Error
    | DocumentNotFoundError
    | DocumentValidationError
    | DocumentArchivedError;

@injectable()
export class DocumentWorkflows {
    constructor(
        @inject(TOKENS.DocumentRepository)
        private readonly documentRepository: DocumentRepository,
        @inject(TOKENS.AuditLogRepository)
        private readonly auditLogRepository: AuditLogRepository,
    ) {}

    createDocument(
        input: CreateDocumentDTOEncoded,
    ): E.Effect<Document, DocumentWorkflowError> {
        return pipe(
            S.decodeUnknown(CreateDocumentDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    E.all([
                        fromResult(UserId.create(dto.ownerId)),
                        fromResult(MimeType.create(dto.mimeType)),
                    ]),
                    E.flatMap(([ownerId, mimeType]) => {
                        const data: CreateEntity<IDocument> = {
                            name: dto.name,
                            description: Option.fromNullable(dto.description),
                            ownerId,
                            slug: dto.slug,
                            mimeType,
                            status: DocumentStatus.Active,
                            latestVersionId: Option.None,
                            metadata: Option.fromNullable(dto.metadata),
                        };
                        return fromResult(Document.create(data));
                    }),
                    E.flatMap((document) =>
                        pipe(
                            repoCall(() =>
                                this.documentRepository.insert(document),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(
                                    opt,
                                    new Error("Insert returned no document"),
                                ),
                            ),
                            E.tap((doc) =>
                                this.logAudit(
                                    dto.ownerId,
                                    AuditAction.DOCUMENT_CREATED,
                                    doc.id,
                                    "document",
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        );
    }

    updateDocument(
        input: UpdateDocumentDTOEncoded,
    ): E.Effect<Document, DocumentWorkflowError> {
        return pipe(
            S.decodeUnknown(UpdateDocumentDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    repoCall(() =>
                        this.documentRepository.fetchById(dto.id),
                    ),
                    E.flatMap((opt) =>
                        unwrapOption(
                            opt,
                            new DocumentNotFoundError(dto.id),
                        ),
                    ),
                    E.flatMap((existing) => {
                        const serialized = existing.serialize();

                        // Apply optional mimeType update
                        const mimeTypeEffect = dto.mimeType
                            ? fromResult(MimeType.create(dto.mimeType))
                            : E.succeed(existing.mimeType);

                        return pipe(
                            mimeTypeEffect,
                            E.map((mimeType) =>
                                Document.fromSerialized({
                                    ...serialized,
                                    name: dto.name ?? serialized.name,
                                    description:
                                        dto.description ?? serialized.description,
                                    slug: dto.slug ?? serialized.slug,
                                    mimeType: MimeType.toString(mimeType),
                                    metadata:
                                        dto.metadata ?? serialized.metadata,
                                    updatedAt: new Date().toISOString(),
                                }),
                            ),
                        );
                    }),
                    E.flatMap((updated) =>
                        pipe(
                            repoCall(() =>
                                this.documentRepository.update(updated),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(
                                    opt,
                                    new DocumentNotFoundError(dto.id),
                                ),
                            ),
                            E.tap((doc) =>
                                this.logAudit(
                                    UserId.toString(doc.ownerId),
                                    AuditAction.DOCUMENT_UPDATED,
                                    doc.id,
                                    "document",
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        );
    }

    changeDocumentStatus(
        input: ChangeDocumentStatusDTOEncoded,
    ): E.Effect<Document, DocumentWorkflowError> {
        return pipe(
            S.decodeUnknown(ChangeDocumentStatusDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    repoCall(() =>
                        this.documentRepository.fetchById(dto.id),
                    ),
                    E.flatMap((opt) =>
                        unwrapOption(
                            opt,
                            new DocumentNotFoundError(dto.id),
                        ),
                    ),
                    E.flatMap((existing) => {
                        const serialized = existing.serialize();
                        const updated = Document.fromSerialized({
                            ...serialized,
                            status: dto.status,
                            updatedAt: new Date().toISOString(),
                        });

                        const auditAction =
                            dto.status === DocumentStatus.Archived
                                ? AuditAction.DOCUMENT_ARCHIVED
                                : dto.status === DocumentStatus.Deleted
                                  ? AuditAction.DOCUMENT_DELETED
                                  : AuditAction.DOCUMENT_RESTORED;

                        return pipe(
                            repoCall(() =>
                                this.documentRepository.update(updated),
                            ),
                            E.flatMap((opt) =>
                                unwrapOption(
                                    opt,
                                    new DocumentNotFoundError(dto.id),
                                ),
                            ),
                            E.tap((doc) =>
                                this.logAudit(
                                    UserId.toString(doc.ownerId),
                                    auditAction,
                                    doc.id,
                                    "document",
                                ),
                            ),
                        );
                    }),
                ),
            ),
        );
    }

    deleteDocument(
        input: DeleteDocumentDTOEncoded,
    ): E.Effect<Document, DocumentWorkflowError> {
        return pipe(
            S.decodeUnknown(DeleteDocumentDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    repoCall(() => this.documentRepository.delete(dto.id)),
                    E.flatMap((opt) =>
                        unwrapOption(
                            opt,
                            new DocumentNotFoundError(dto.id),
                        ),
                    ),
                    E.tap((doc) =>
                        this.logAudit(
                            UserId.toString(doc.ownerId),
                            AuditAction.DOCUMENT_DELETED,
                            doc.id,
                            "document",
                        ),
                    ),
                ),
            ),
        );
    }

    getDocumentById(id: string): E.Effect<Document, DocumentWorkflowError> {
        return pipe(
            repoCall(() => this.documentRepository.fetchById(id)),
            E.flatMap((opt) =>
                unwrapOption(opt, new DocumentNotFoundError(id)),
            ),
        );
    }

    getDocumentBySlug(
        slug: string,
    ): E.Effect<Document, DocumentWorkflowError> {
        return pipe(
            repoCall(() => this.documentRepository.fetchBySlug(slug)),
            E.flatMap((opt) =>
                unwrapOption(opt, new DocumentNotFoundError(slug)),
            ),
        );
    }

    listDocuments(
        input: ListDocumentsDTOEncoded,
    ): E.Effect<Paginated<Document>, DocumentWorkflowError> {
        return pipe(
            S.decodeUnknown(ListDocumentsDTOSchema)(input),
            E.mapError(() => new Error("Validation failed")),
            E.flatMap((dto) =>
                pipe(
                    fromResult(
                        PaginationOptions.create({
                            pageNum: dto.pageNum ?? 1,
                            pageSize: dto.pageSize ?? 100,
                        }),
                    ),
                    E.flatMap((opts) =>
                        repoCall(() =>
                            this.documentRepository.findPaginated(opts, {
                                status: dto.status,
                                ownerId: dto.ownerId,
                            }),
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
            E.flatMap((log) => repoCall(() => this.auditLogRepository.insert(log))),
            E.map(() => undefined),
        );
    }
}
