import { DocumentStatus } from "@domain/document/document.enums";
import { Schema as S } from "effect";

// ─── Commands ─────────────────────────────────────────────────────────────────

export const CreateDocumentDTOSchema = S.Struct({
	name: S.String,
	description: S.optional(S.String),
	ownerId: S.String,
	slug: S.String,
	mimeType: S.String,
	metadata: S.optional(S.Record({ key: S.String, value: S.Unknown })),
});

export type CreateDocumentDTO = S.Schema.Type<typeof CreateDocumentDTOSchema>;
export type CreateDocumentDTOEncoded = S.Schema.Encoded<
	typeof CreateDocumentDTOSchema
>;

export const UpdateDocumentDTOSchema = S.Struct({
	id: S.String,
	name: S.optional(S.String),
	description: S.optional(S.String),
	slug: S.optional(S.String),
	mimeType: S.optional(S.String),
	metadata: S.optional(S.Record({ key: S.String, value: S.Unknown })),
});

export type UpdateDocumentDTO = S.Schema.Type<typeof UpdateDocumentDTOSchema>;
export type UpdateDocumentDTOEncoded = S.Schema.Encoded<
	typeof UpdateDocumentDTOSchema
>;

export const DeleteDocumentDTOSchema = S.Struct({
	id: S.String,
});

export type DeleteDocumentDTO = S.Schema.Type<typeof DeleteDocumentDTOSchema>;
export type DeleteDocumentDTOEncoded = S.Schema.Encoded<
	typeof DeleteDocumentDTOSchema
>;

export const ChangeDocumentStatusDTOSchema = S.Struct({
	id: S.String,
	status: S.Enums(DocumentStatus),
});

export type ChangeDocumentStatusDTO = S.Schema.Type<
	typeof ChangeDocumentStatusDTOSchema
>;
export type ChangeDocumentStatusDTOEncoded = S.Schema.Encoded<
	typeof ChangeDocumentStatusDTOSchema
>;

// ─── Upload Commands ──────────────────────────────────────────────────────────

export const InitiateUploadDTOSchema = S.Struct({
	documentId: S.String,
	mimeType: S.String,
	sizeBytes: S.Number,
	uploadedBy: S.String,
});

export type InitiateUploadDTO = S.Schema.Type<typeof InitiateUploadDTOSchema>;
export type InitiateUploadDTOEncoded = S.Schema.Encoded<
	typeof InitiateUploadDTOSchema
>;

export const ConfirmUploadDTOSchema = S.Struct({
	documentId: S.String,
	storageKey: S.String,
	mimeType: S.String,
	sizeBytes: S.Number,
	checksum: S.String,
	uploadedBy: S.String,
});

export type ConfirmUploadDTO = S.Schema.Type<typeof ConfirmUploadDTOSchema>;
export type ConfirmUploadDTOEncoded = S.Schema.Encoded<
	typeof ConfirmUploadDTOSchema
>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export const GetDocumentByIdDTOSchema = S.Struct({
	id: S.String,
});

export type GetDocumentByIdDTO = S.Schema.Type<typeof GetDocumentByIdDTOSchema>;
export type GetDocumentByIdDTOEncoded = S.Schema.Encoded<
	typeof GetDocumentByIdDTOSchema
>;

export const GetDocumentBySlugDTOSchema = S.Struct({
	slug: S.String,
});

export type GetDocumentBySlugDTO = S.Schema.Type<
	typeof GetDocumentBySlugDTOSchema
>;
export type GetDocumentBySlugDTOEncoded = S.Schema.Encoded<
	typeof GetDocumentBySlugDTOSchema
>;

export const ListDocumentsDTOSchema = S.Struct({
	status: S.optional(S.Enums(DocumentStatus)),
	ownerId: S.optional(S.String),
	pageNum: S.optional(S.Number),
	pageSize: S.optional(S.Number),
});

export type ListDocumentsDTO = S.Schema.Type<typeof ListDocumentsDTOSchema>;
export type ListDocumentsDTOEncoded = S.Schema.Encoded<
	typeof ListDocumentsDTOSchema
>;

export const ListDocumentVersionsDTOSchema = S.Struct({
	documentId: S.String,
	pageNum: S.optional(S.Number),
	pageSize: S.optional(S.Number),
});

export type ListDocumentVersionsDTO = S.Schema.Type<
	typeof ListDocumentVersionsDTOSchema
>;
export type ListDocumentVersionsDTOEncoded = S.Schema.Encoded<
	typeof ListDocumentVersionsDTOSchema
>;

// ─── Response DTOs ────────────────────────────────────────────────────────────

export const DocumentResponseDTOSchema = S.Struct({
	id: S.String,
	name: S.String,
	description: S.NullOr(S.String),
	ownerId: S.String,
	slug: S.String,
	mimeType: S.String,
	status: S.Enums(DocumentStatus),
	latestVersionId: S.NullOr(S.String),
	metadata: S.NullOr(S.Record({ key: S.String, value: S.Unknown })),
	createdAt: S.String,
	updatedAt: S.String,
});
export type DocumentResponseDTO = S.Schema.Type<
	typeof DocumentResponseDTOSchema
>;

export const DocumentVersionResponseDTOSchema = S.Struct({
	id: S.String,
	documentId: S.String,
	versionNumber: S.Number,
	storageKey: S.String,
	mimeType: S.String,
	sizeBytes: S.Number,
	checksum: S.String,
	uploadedBy: S.String,
	createdAt: S.String,
	updatedAt: S.String,
});
export type DocumentVersionResponseDTO = S.Schema.Type<
	typeof DocumentVersionResponseDTOSchema
>;

export const PaginatedDocumentsResponseDTOSchema = S.Struct({
	data: S.Array(DocumentResponseDTOSchema),
	pageNum: S.Number,
	pageSize: S.Number,
	totalPages: S.Number,
});
export type PaginatedDocumentsResponseDTO = S.Schema.Type<
	typeof PaginatedDocumentsResponseDTOSchema
>;

export const UploadInitiationResponseDTOSchema = S.Struct({
	documentId: S.String,
	storageKey: S.String,
	uploadUrl: S.String,
	expiresAt: S.Date,
});
export type UploadInitiationResponseDTO = S.Schema.Type<
	typeof UploadInitiationResponseDTOSchema
>;
