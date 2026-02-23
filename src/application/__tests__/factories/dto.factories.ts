/**
 * Application DTO factories for workflow integration testing.
 *
 * Generates realistic command/query DTOs to feed into workflow use cases.
 * Separate from domain factories — these produce application-layer input contracts.
 */

import type {
	CheckAccessDTOEncoded,
	GrantAccessDTOEncoded,
	RevokeAccessDTOEncoded,
	UpdateAccessDTOEncoded,
} from "@application/dto/access-policy/access-policy.dto";
import type {
	ChangeDocumentStatusDTOEncoded,
	ConfirmUploadDTOEncoded,
	CreateDocumentDTOEncoded,
	InitiateUploadDTOEncoded,
	ListDocumentsDTOEncoded,
	ListDocumentVersionsDTOEncoded,
	UpdateDocumentDTOEncoded,
} from "@application/dto/document/document.dto";
import type {
	CreateUserDTOEncoded,
	UpdateUserDTOEncoded,
} from "@application/dto/user/user.dto";
import {
	AccessLevel,
	type DocumentStatus,
} from "@domain/document/document.enums";
import { UserRole } from "@domain/user/user.enums";
import { faker } from "@faker-js/faker";

// ─── User Command Factories ──────────────────────────────────────────────────

export interface CreateUserCommandOverrides {
	workspaceId?: string;
	email?: string;
	role?: UserRole;
	passwordHash?: string;
	displayName?: string;
	isActive?: boolean;
}

export function makeCreateUserCommand(
	overrides: CreateUserCommandOverrides = {},
): CreateUserDTOEncoded {
	return {
		workspaceId: overrides.workspaceId ?? crypto.randomUUID(),
		email: overrides.email ?? faker.internet.email().toLowerCase(),
		role: overrides.role ?? UserRole.USER,
		passwordHash:
			overrides.passwordHash ??
			"$2b$10$hashedpasswordfortesting1234567890abcdef",
		displayName: overrides.displayName ?? faker.person.fullName(),
		isActive: overrides.isActive ?? true,
	};
}

export function makeCreateAdminCommand(
	overrides: CreateUserCommandOverrides = {},
): CreateUserDTOEncoded {
	return makeCreateUserCommand({ role: UserRole.ADMIN, ...overrides });
}

export interface UpdateUserCommandOverrides {
	id: string;
	email?: string;
	role?: UserRole;
	passwordHash?: string;
	displayName?: string;
	isActive?: boolean;
}

export function makeUpdateUserCommand(
	overrides: UpdateUserCommandOverrides,
): UpdateUserDTOEncoded {
	return {
		id: overrides.id,
		...(overrides.email !== undefined && { email: overrides.email }),
		...(overrides.role !== undefined && { role: overrides.role }),
		...(overrides.passwordHash !== undefined && {
			passwordHash: overrides.passwordHash,
		}),
		...(overrides.displayName !== undefined && {
			displayName: overrides.displayName,
		}),
		...(overrides.isActive !== undefined && { isActive: overrides.isActive }),
	};
}

// ─── Document Command Factories ──────────────────────────────────────────────

export interface CreateDocumentCommandOverrides {
	name?: string;
	description?: string;
	ownerId?: string;
	slug?: string;
	mimeType?: string;
	metadata?: Record<string, unknown>;
}

export function makeCreateDocumentCommand(
	ownerId: string,
	overrides: CreateDocumentCommandOverrides = {},
): CreateDocumentDTOEncoded {
	const name = overrides.name ?? faker.system.fileName({ extensionCount: 0 });
	return {
		name,
		description: overrides.description ?? faker.lorem.sentence(),
		ownerId: overrides.ownerId ?? ownerId,
		slug: overrides.slug ?? faker.helpers.slugify(name).toLowerCase(),
		mimeType: overrides.mimeType ?? "application/pdf",
		metadata: overrides.metadata,
	};
}

export interface UpdateDocumentCommandOverrides {
	id: string;
	name?: string;
	description?: string;
	slug?: string;
	mimeType?: string;
	metadata?: Record<string, unknown>;
}

export function makeUpdateDocumentCommand(
	overrides: UpdateDocumentCommandOverrides,
): UpdateDocumentDTOEncoded {
	return {
		id: overrides.id,
		...(overrides.name !== undefined && { name: overrides.name }),
		...(overrides.description !== undefined && {
			description: overrides.description,
		}),
		...(overrides.slug !== undefined && { slug: overrides.slug }),
		...(overrides.mimeType !== undefined && { mimeType: overrides.mimeType }),
		...(overrides.metadata !== undefined && { metadata: overrides.metadata }),
	};
}

export function makeChangeStatusCommand(
	id: string,
	status: DocumentStatus,
): ChangeDocumentStatusDTOEncoded {
	return { id, status };
}

export function makeListDocumentsQuery(
	overrides: Partial<ListDocumentsDTOEncoded> = {},
): ListDocumentsDTOEncoded {
	return {
		pageNum: overrides.pageNum ?? 1,
		pageSize: overrides.pageSize ?? 100,
		...(overrides.status !== undefined && { status: overrides.status }),
		...(overrides.ownerId !== undefined && { ownerId: overrides.ownerId }),
	};
}

// ─── Upload Command Factories ────────────────────────────────────────────────

export interface InitiateUploadCommandOverrides {
	documentId: string;
	uploadedBy: string;
	mimeType?: string;
	sizeBytes?: number;
}

export function makeInitiateUploadCommand(
	overrides: InitiateUploadCommandOverrides,
): InitiateUploadDTOEncoded {
	return {
		documentId: overrides.documentId,
		mimeType: overrides.mimeType ?? "application/pdf",
		sizeBytes:
			overrides.sizeBytes ??
			faker.number.int({ min: 1024, max: 10 * 1024 * 1024 }),
		uploadedBy: overrides.uploadedBy,
	};
}

export interface ConfirmUploadCommandOverrides {
	documentId: string;
	uploadedBy: string;
	storageKey?: string;
	mimeType?: string;
	sizeBytes?: number;
	checksum?: string;
}

export function makeConfirmUploadCommand(
	overrides: ConfirmUploadCommandOverrides,
): ConfirmUploadDTOEncoded {
	return {
		documentId: overrides.documentId,
		storageKey:
			overrides.storageKey ??
			`uploads/${crypto.randomUUID()}/${faker.system.fileName()}`,
		mimeType: overrides.mimeType ?? "application/pdf",
		sizeBytes:
			overrides.sizeBytes ??
			faker.number.int({ min: 1024, max: 10 * 1024 * 1024 }),
		checksum:
			overrides.checksum ??
			faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" }),
		uploadedBy: overrides.uploadedBy,
	};
}

export function makeListVersionsQuery(
	documentId: string,
	overrides: Partial<ListDocumentVersionsDTOEncoded> = {},
): ListDocumentVersionsDTOEncoded {
	return {
		documentId,
		pageNum: overrides.pageNum ?? 1,
		pageSize: overrides.pageSize ?? 100,
	};
}

// ─── Access Policy Command Factories ─────────────────────────────────────────

export interface GrantAccessCommandOverrides {
	documentId: string;
	userId: string;
	grantedBy: string;
	accessLevel?: AccessLevel;
}

export function makeGrantAccessCommand(
	overrides: GrantAccessCommandOverrides,
): GrantAccessDTOEncoded {
	return {
		documentId: overrides.documentId,
		userId: overrides.userId,
		accessLevel: overrides.accessLevel ?? AccessLevel.READ,
		grantedBy: overrides.grantedBy,
	};
}

export function makeUpdateAccessCommand(
	policyId: string,
	accessLevel: AccessLevel,
): UpdateAccessDTOEncoded {
	return { policyId, accessLevel };
}

export function makeRevokeAccessCommand(
	policyId: string,
): RevokeAccessDTOEncoded {
	return { policyId };
}

export function makeCheckAccessQuery(
	userId: string,
	documentId: string,
	action: AccessLevel,
): CheckAccessDTOEncoded {
	return { userId, documentId, action };
}
