/**
 * Response mappers: transform domain entities into DTO-compatible shapes.
 *
 * Domain entities use branded types and Option, while response DTOs expect
 * plain strings / null. These mappers bridge the gap so procedures return
 * serializable data that matches the declared output schemas.
 */

import type { AccessPolicyResponseDTO } from "@application/dto/access-policy/access-policy.dto";
import type {
	DocumentResponseDTO,
	DocumentVersionResponseDTO,
	PaginatedDocumentsResponseDTO,
	UploadInitiationResponseDTO,
} from "@application/dto/document/document.dto";
import type { UserResponseDTO } from "@application/dto/user/user.dto";
import type { UploadInitiation } from "@application/workflow/documents/upload.workflow";
import type { AccessPolicy } from "@domain/access-policy/access-policy.entity";
import type { Document } from "@domain/document/document.entity";
import type { DocumentVersion } from "@domain/document/document-version.entity";
import type { Paginated } from "@domain/shared/pagination";
import type { User } from "@domain/user/user.entity";

export function toDocumentResponse(doc: Document): DocumentResponseDTO {
	const s = doc.serialize();
	return {
		id: s.id,
		name: s.name,
		description: s.description,
		ownerId: s.ownerId,
		slug: s.slug,
		mimeType: s.mimeType,
		status: s.status as DocumentResponseDTO["status"],
		latestVersionId: s.latestVersionId ?? null,
		metadata: s.metadata,
		createdAt: s.createdAt,
		updatedAt: s.updatedAt,
	};
}

export function toDocumentVersionResponse(
	v: DocumentVersion,
): DocumentVersionResponseDTO {
	const s = v.serialize();
	return {
		id: s.id,
		documentId: s.documentId,
		versionNumber: s.versionNumber,
		storageKey: s.storageKey,
		mimeType: s.mimeType,
		sizeBytes: s.sizeBytes,
		checksum: s.checksum,
		uploadedBy: s.uploadedBy,
		createdAt: s.createdAt,
		updatedAt: s.updatedAt,
	};
}

export function toPaginatedDocumentsResponse(
	paginated: Paginated<Document>,
): PaginatedDocumentsResponseDTO {
	return {
		data: paginated.data.map(toDocumentResponse),
		pageNum: paginated.pageNum,
		pageSize: paginated.pageSize,
		totalPages: paginated.totalPages,
	};
}

export function toUploadInitiationResponse(
	u: UploadInitiation,
): UploadInitiationResponseDTO {
	return {
		documentId: u.documentId,
		storageKey: u.storageKey,
		uploadUrl: u.uploadUrl,
		expiresAt: u.expiresAt,
	};
}

export function toAccessPolicyResponse(
	p: AccessPolicy,
): AccessPolicyResponseDTO {
	const s = p.serialize();
	return {
		id: s.id,
		documentId: s.documentId,
		userId: s.userId,
		accessLevel: s.accessLevel as AccessPolicyResponseDTO["accessLevel"],
		createdAt: s.createdAt,
		updatedAt: s.updatedAt,
	};
}

export function toUserResponse(u: User): UserResponseDTO {
	const s = u.serialize();
	return {
		id: s.id,
		workspaceId: s.workspaceId,
		email: s.email,
		role: s.role as UserResponseDTO["role"],
		displayName: s.displayName ?? undefined,
		isActive: s.isActive,
		createdAt: new Date(s.createdAt),
		updatedAt: new Date(s.updatedAt),
	};
}
