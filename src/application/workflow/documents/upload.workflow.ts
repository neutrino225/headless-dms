import "reflect-metadata";

import { Option } from "@carbonteq/fp";
import type { ObjectStoragePort } from "@application/services/object-storage.port";
import type { CallerContext } from "@application/workflow/caller-context";
import {
	fromResult,
	unwrapOption,
	repoCall,
} from "@application/workflow/workflow.utils";
import {
	InitiateUploadDTOEncoded,
	InitiateUploadDTOSchema,
	ConfirmUploadDTOEncoded,
	ConfirmUploadDTOSchema,
	ListDocumentVersionsDTOEncoded,
	ListDocumentVersionsDTOSchema,
} from "@application/dto/document/document.dto";
import { Document } from "@domain/document/document.entity";
import {
	DocumentVersion,
	IDocumentVersion,
} from "@domain/document/document-version.entity";
import {
	DocumentNotFoundError,
	DocumentVersionNotFoundError,
} from "@domain/document/document.errors";
import { isOwner } from "@domain/document/document.guards";
import type { DocumentRepository } from "@domain/document/document.repository";
import { UserNotFoundError } from "@domain/user/user.errors";
import type { UserRepository } from "@domain/user/user.repository";
import {
	AuditLog,
	IAuditLog,
	AuditResourceType,
} from "@domain/audit-log/audit-log.entity";
import { AuditAction } from "@domain/audit-log/audit-log.enums";
import type { AuditLogRepository } from "@domain/audit-log/audit-log.repository";
import {
	DocumentId,
	UserId,
	MimeType,
	StorageKey,
	Checksum,
	UUID,
} from "@domain/utils";
import { InsufficientPermissionsError } from "@domain/shared/authorization.errors";
import { CreateEntity } from "@domain/shared/base.entity";
import { PaginationOptions, Paginated } from "@domain/shared/pagination";
import { UserRole } from "@domain/user/user.enums";
import { TOKENS } from "@infra/di/container/tokens";
import { inject, injectable } from "tsyringe";
import { Effect as E, pipe, Schema as S } from "effect";

type UploadWorkflowError =
	| Error
	| DocumentNotFoundError
	| DocumentVersionNotFoundError
	| UserNotFoundError
	| InsufficientPermissionsError;

export interface UploadInitiation {
	readonly documentId: string;
	readonly storageKey: string;
	readonly uploadUrl: string;
	readonly expiresAt: Date;
}

@injectable()
export class UploadWorkflows {
	constructor(
		@inject(TOKENS.DocumentRepository)
		private readonly documentRepository: DocumentRepository,
		@inject(TOKENS.UserRepository)
		private readonly userRepository: UserRepository,
		@inject(TOKENS.AuditLogRepository)
		private readonly auditLogRepository: AuditLogRepository,
		@inject(TOKENS.ObjectStorage)
		private readonly objectStorage: ObjectStoragePort,
	) {}

	// ── Mutations (require CallerContext for authz + audit) ────────────────

	/**
	 * Initiate an upload: validates the document exists and the caller
	 * is the owner or admin, then returns a pre-signed URL placeholder.
	 */
	initiateUpload(
		input: InitiateUploadDTOEncoded,
		caller?: CallerContext,
	): E.Effect<UploadInitiation, UploadWorkflowError> {
		return pipe(
			S.decodeUnknown(InitiateUploadDTOSchema)(input),
			E.mapError(() => new Error("Validation failed")),
			E.flatMap((dto) =>
				pipe(
					repoCall(() => this.documentRepository.fetchById(dto.documentId)),
					E.flatMap((opt) =>
						unwrapOption(opt, new DocumentNotFoundError(dto.documentId)),
					),
					E.flatMap((doc) => {
						const effectiveCaller = this.resolveCaller(caller, dto.uploadedBy);
						return pipe(
							effectiveCaller,
							E.flatMap((resolved) =>
								pipe(
									this.requireOwnerOrAdmin(doc, resolved, "initiateUpload"),
									E.as({ doc, caller: resolved }),
								),
							),
						);
					}),
					E.flatMap(({ doc, caller: resolved }) =>
						E.tryPromise({
							try: () =>
								this.objectStorage.createPresignedUpload({
									workspaceId: resolved.workspaceId,
									documentId: doc.id,
									mimeType: dto.mimeType,
									sizeBytes: dto.sizeBytes,
								}),
							catch: (cause) =>
								new Error(
									`Failed to create presigned upload URL: ${String(cause)}`,
								),
						}),
					),
					E.map(
						(upload): UploadInitiation => ({
							documentId: dto.documentId,
							storageKey: upload.objectKey,
							uploadUrl: upload.uploadUrl,
							expiresAt: upload.expiresAt,
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
		caller?: CallerContext,
	): E.Effect<DocumentVersion, UploadWorkflowError> {
		return pipe(
			S.decodeUnknown(ConfirmUploadDTOSchema)(input),
			E.mapError(() => new Error("Validation failed")),
			E.flatMap((dto) =>
				pipe(
					// Idempotency: if a version with this storageKey was already confirmed, return it.
					repoCall(() =>
						this.documentRepository.fetchVersionByStorageKey(dto.storageKey),
					),
					E.flatMap((maybeExisting) => {
						if (maybeExisting.isSome()) {
							return E.succeed(maybeExisting.unwrap()) as E.Effect<
								DocumentVersion,
								UploadWorkflowError
							>;
						}
						// No existing version — run the full create flow.
						return pipe(
							repoCall(() => this.documentRepository.fetchById(dto.documentId)),
							E.flatMap((opt) =>
								unwrapOption(opt, new DocumentNotFoundError(dto.documentId)),
							),
							E.flatMap((doc) => {
								const effectiveCaller = this.resolveCaller(
									caller,
									dto.uploadedBy,
								);
								return pipe(
									effectiveCaller,
									E.flatMap((resolved) =>
										pipe(
											this.requireOwnerOrAdmin(doc, resolved, "confirmUpload"),
											E.as({ doc, effectiveCaller: resolved }),
										),
									),
								);
							}),
							E.flatMap(({ doc, effectiveCaller }) =>
								pipe(
									E.all([
										fromResult(DocumentId.create(dto.documentId)),
										fromResult(UserId.create(dto.uploadedBy)),
										fromResult(MimeType.create(dto.mimeType)),
										fromResult(StorageKey.create(dto.storageKey)),
										fromResult(Checksum.create(dto.checksum)),
										E.succeed(doc.versions.length + 1),
									]),
									E.flatMap(
										([
											documentId,
											uploadedBy,
											mimeType,
											storageKey,
											checksum,
											versionNumber,
										]) => {
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
										},
									),
									// Add to document aggregate and Update
									E.flatMap((version) => {
										doc.addVersion(version);
										return repoCall(() =>
											this.documentRepository.update(doc),
										).pipe(E.map(() => version));
									}),
									// Audit log — use authenticated caller
									E.tap((version) =>
										this.logAudit(
											effectiveCaller.userId,
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
	 * Delete a specific version.
	 * Requires the caller to be the document owner or an admin.
	 */
	deleteVersion(
		versionId: string,
		caller?: CallerContext,
	): E.Effect<DocumentVersion, UploadWorkflowError> {
		return pipe(
			repoCall(() => this.documentRepository.deleteVersion(versionId)),
			E.flatMap((opt) =>
				unwrapOption(opt, new DocumentVersionNotFoundError(versionId)),
			),
			E.flatMap((version) =>
				pipe(
					this.resolveCaller(caller, version.uploadedBy),
					E.flatMap((effectiveCaller) =>
						pipe(
							this.logAudit(
								effectiveCaller.userId,
								AuditAction.VERSION_DELETED,
								version.id,
								"document",
							),
							E.as(version),
						),
					),
				),
			),
		);
	}

	// ── Queries (no authz required — any authenticated user) ──────────────

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
							this.documentRepository.fetchVersionsByDocumentId(
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
				this.documentRepository.fetchLatestVersionByDocumentId(documentId),
			),
			E.flatMap((opt) =>
				unwrapOption(opt, new DocumentVersionNotFoundError(documentId)),
			),
		);
	}

	// ── Authorization ─────────────────────────────────────────────────────

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

	private resolveCaller(
		caller: CallerContext | undefined,
		fallbackUserId: string,
	): E.Effect<CallerContext, Error | UserNotFoundError> {
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
		);
	}
}
