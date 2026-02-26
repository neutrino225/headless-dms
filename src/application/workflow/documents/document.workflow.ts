import "reflect-metadata";

import {
  type ChangeDocumentStatusDTOEncoded,
  ChangeDocumentStatusDTOSchema,
  type CreateDocumentDTOEncoded,
  CreateDocumentDTOSchema,
  type DeleteDocumentDTOEncoded,
  DeleteDocumentDTOSchema,
  type ListDocumentsDTOEncoded,
  ListDocumentsDTOSchema,
  type UpdateDocumentDTOEncoded,
  UpdateDocumentDTOSchema,
} from "@application/dto/document/document.dto";
import type { CallerContext } from "@application/workflow/caller-context";
import { WorkflowInfraError } from "@application/errors";
import {
  fromResult,
  mapInfraError,
  repoCall,
  unwrapOption,
} from "@application/workflow/workflow.utils";
import { Option } from "@carbonteq/fp";
import {
  AuditLog,
  type AuditResourceType,
  type IAuditLog,
} from "@domain/audit-log/audit-log.entity";
import { AuditAction } from "@domain/audit-log/audit-log.enums";
import type { AuditLogRepository } from "@domain/audit-log/audit-log.repository";
import { Document, type IDocument } from "@domain/document/document.entity";
import { DocumentStatus } from "@domain/document/document.enums";
import {
  type DocumentArchivedError,
  DocumentNotFoundError,
  DocumentValidationError,
} from "@domain/document/document.errors";
import { isOwner } from "@domain/document/document.guards";
import type { DocumentRepository } from "@domain/document/document.repository";
import { InsufficientPermissionsError } from "@domain/shared/authorization.errors";
import type { CreateEntity } from "@domain/shared/base.entity";
import { type Paginated, PaginationOptions } from "@domain/shared/pagination";
import { UserRole } from "@domain/user/user.enums";
import { UserNotFoundError } from "@domain/user/user.errors";
import type { UserRepository } from "@domain/user/user.repository";
import { MimeType, UserId, UUID } from "@domain/utils";
import { TOKENS } from "@infra/di/container/tokens";
import { Effect as E, pipe, Schema as S } from "effect";
import { inject, injectable } from "tsyringe";

type DocumentWorkflowError =
  | WorkflowInfraError
  | DocumentNotFoundError
  | DocumentValidationError
  | DocumentArchivedError
  | UserNotFoundError
  | InsufficientPermissionsError;

@injectable()
export class DocumentWorkflows {
  constructor(
    @inject(TOKENS.DocumentRepository)
    private readonly documentRepository: DocumentRepository,
    @inject(TOKENS.UserRepository)
    private readonly userRepository: UserRepository,
    @inject(TOKENS.AuditLogRepository)
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  // ── Mutations (require CallerContext for authz + audit) ────────────────

  createDocument(
    input: CreateDocumentDTOEncoded,
    caller?: CallerContext,
  ): E.Effect<Document, DocumentWorkflowError> {
    return pipe(
      S.decodeUnknown(CreateDocumentDTOSchema)(input),
      E.mapError(
        () =>
          new DocumentValidationError(
            "Validation failed",
          ) as DocumentWorkflowError,
      ),
      E.flatMap((dto) => {
        return pipe(
          this.resolveCaller(caller, dto.ownerId),
          E.flatMap((effectiveCaller) =>
            pipe(
              E.Do,
              E.bind("ownerId", () => fromResult(UserId.create(dto.ownerId))),
              E.bind("mimeType", () =>
                fromResult(MimeType.create(dto.mimeType)),
              ),
              E.flatMap(({ ownerId, mimeType }) => {
                const data: CreateEntity<IDocument> = {
                  name: dto.name,
                  description: Option.fromNullable(dto.description),
                  ownerId,
                  slug: dto.slug,
                  mimeType,
                  status: DocumentStatus.Active,
                  latestVersionId: Option.None,
                  metadata: Option.fromNullable(dto.metadata),
                  versions: [],
                };
                return fromResult(Document.create(data));
              }),
              E.flatMap((document) =>
                pipe(
                  repoCall(() => this.documentRepository.insert(document)),
                  E.flatMap((opt) =>
                    unwrapOption(opt, new Error("Insert returned no document")),
                  ),
                  E.tap((doc) =>
                    this.logAudit(
                      effectiveCaller.userId,
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
      }),
      mapInfraError("document.createDocument"),
    ) as E.Effect<Document, DocumentWorkflowError>;
  }

  updateDocument(
    input: UpdateDocumentDTOEncoded,
    caller?: CallerContext,
  ): E.Effect<Document, DocumentWorkflowError> {
    return pipe(
      S.decodeUnknown(UpdateDocumentDTOSchema)(input),
      E.mapError(
        () =>
          new DocumentValidationError(
            "Validation failed",
          ) as DocumentWorkflowError,
      ),
      E.flatMap((dto) =>
        pipe(
          repoCall(() => this.documentRepository.fetchById(dto.id)),
          E.flatMap((opt) =>
            unwrapOption(opt, new DocumentNotFoundError(dto.id)),
          ),
          E.flatMap((existing) => {
            return pipe(
              this.resolveCaller(caller, existing.ownerId),
              E.flatMap((effectiveCaller) =>
                pipe(
                  this.requireOwnerOrAdmin(existing, effectiveCaller, "update"),
                  E.as({ existing, effectiveCaller }),
                ),
              ),
            );
          }),
          E.flatMap(({ existing, effectiveCaller }) => {
            const serialized = existing.serialize();
            const mimeTypeEffect = dto.mimeType
              ? fromResult(MimeType.create(dto.mimeType))
              : E.succeed(existing.mimeType);

            return pipe(
              mimeTypeEffect,
              E.map((mimeType) =>
                Document.fromSerialized({
                  ...serialized,
                  name: dto.name ?? serialized.name,
                  description: dto.description ?? serialized.description,
                  slug: dto.slug ?? serialized.slug,
                  mimeType: MimeType.toString(mimeType),
                  metadata: dto.metadata ?? serialized.metadata,
                  updatedAt: new Date().toISOString(),
                }),
              ),
              E.flatMap((updated) =>
                pipe(
                  repoCall(() => this.documentRepository.update(updated)),
                  E.flatMap((opt) =>
                    unwrapOption(opt, new DocumentNotFoundError(dto.id)),
                  ),
                  E.tap((doc) =>
                    this.logAudit(
                      effectiveCaller.userId,
                      AuditAction.DOCUMENT_UPDATED,
                      doc.id,
                      "document",
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
      mapInfraError("document.updateDocument"),
    ) as E.Effect<Document, DocumentWorkflowError>;
  }

  changeDocumentStatus(
    input: ChangeDocumentStatusDTOEncoded,
    caller?: CallerContext,
  ): E.Effect<Document, DocumentWorkflowError> {
    return pipe(
      S.decodeUnknown(ChangeDocumentStatusDTOSchema)(input),
      E.mapError(
        () =>
          new DocumentValidationError(
            "Validation failed",
          ) as DocumentWorkflowError,
      ),
      E.flatMap((dto) =>
        pipe(
          repoCall(() => this.documentRepository.fetchById(dto.id)),
          E.flatMap((opt) =>
            unwrapOption(opt, new DocumentNotFoundError(dto.id)),
          ),
          E.flatMap((existing) => {
            return pipe(
              this.resolveCaller(caller, existing.ownerId),
              E.flatMap((effectiveCaller) =>
                pipe(
                  this.requireOwnerOrAdmin(
                    existing,
                    effectiveCaller,
                    "changeStatus",
                  ),
                  E.as({ existing, effectiveCaller }),
                ),
              ),
            );
          }),
          E.flatMap((existing) => {
            const { effectiveCaller } = existing;
            const serialized = existing.existing.serialize();
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
              repoCall(() => this.documentRepository.update(updated)),
              E.flatMap((opt) =>
                unwrapOption(opt, new DocumentNotFoundError(dto.id)),
              ),
              E.tap((doc) =>
                this.logAudit(
                  effectiveCaller.userId,
                  auditAction,
                  doc.id,
                  "document",
                ),
              ),
            );
          }),
        ),
      ),
      mapInfraError("document.changeDocumentStatus"),
    ) as E.Effect<Document, DocumentWorkflowError>;
  }

  deleteDocument(
    input: DeleteDocumentDTOEncoded,
    caller?: CallerContext,
  ): E.Effect<Document, DocumentWorkflowError> {
    return pipe(
      S.decodeUnknown(DeleteDocumentDTOSchema)(input),
      E.mapError(
        () =>
          new DocumentValidationError(
            "Validation failed",
          ) as DocumentWorkflowError,
      ),
      E.flatMap((dto) =>
        pipe(
          // Load first to check authorization before deleting
          repoCall(() => this.documentRepository.fetchById(dto.id)),
          E.flatMap((opt) =>
            unwrapOption(opt, new DocumentNotFoundError(dto.id)),
          ),
          E.flatMap((existing) => {
            return pipe(
              this.resolveCaller(caller, existing.ownerId),
              E.flatMap((effectiveCaller) =>
                pipe(
                  this.requireOwnerOrAdmin(existing, effectiveCaller, "delete"),
                  E.as(effectiveCaller),
                ),
              ),
            );
          }),
          E.flatMap((effectiveCaller) =>
            pipe(
              repoCall(() => this.documentRepository.delete(dto.id)),
              E.flatMap((opt) =>
                unwrapOption(opt, new DocumentNotFoundError(dto.id)),
              ),
              E.tap((doc) =>
                this.logAudit(
                  effectiveCaller.userId,
                  AuditAction.DOCUMENT_DELETED,
                  doc.id,
                  "document",
                ),
              ),
            ),
          ),
        ),
      ),
      mapInfraError("document.deleteDocument"),
    ) as E.Effect<Document, DocumentWorkflowError>;
  }

  // ── Queries (no authz required — any authenticated user) ──────────────

  getDocumentById(id: string): E.Effect<Document, DocumentWorkflowError> {
    return pipe(
      repoCall(() => this.documentRepository.fetchById(id)),
      E.flatMap((opt) => unwrapOption(opt, new DocumentNotFoundError(id))),
      mapInfraError("document.getDocumentById"),
    ) as E.Effect<Document, DocumentWorkflowError>;
  }

  getDocumentBySlug(slug: string): E.Effect<Document, DocumentWorkflowError> {
    return pipe(
      repoCall(() => this.documentRepository.fetchBySlug(slug)),
      E.flatMap((opt) => unwrapOption(opt, new DocumentNotFoundError(slug))),
      mapInfraError("document.getDocumentBySlug"),
    ) as E.Effect<Document, DocumentWorkflowError>;
  }

  listDocuments(
    input: ListDocumentsDTOEncoded,
  ): E.Effect<Paginated<Document>, DocumentWorkflowError> {
    return pipe(
      S.decodeUnknown(ListDocumentsDTOSchema)(input),
      E.mapError(
        () =>
          new DocumentValidationError(
            "Validation failed",
          ) as DocumentWorkflowError,
      ),
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
      mapInfraError("document.listDocuments"),
    ) as E.Effect<Paginated<Document>, DocumentWorkflowError>;
  }

  // ── Authorization ─────────────────────────────────────────────────────

  /**
   * Require the caller to be the document owner or an ADMIN.
   * Returns E.fail(InsufficientPermissionsError) when neither condition holds.
   */
  private requireOwnerOrAdmin(
    document: Document,
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
          metadata: null,
        };
        return fromResult(AuditLog.create(data));
      }),
      E.flatMap((log) => repoCall(() => this.auditLogRepository.insert(log))),
      E.map(() => undefined),
      mapInfraError("document.logAudit"),
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
      mapInfraError("document.resolveCaller"),
    ) as E.Effect<CallerContext, WorkflowInfraError | UserNotFoundError>;
  }
}
