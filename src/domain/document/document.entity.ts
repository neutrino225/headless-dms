import { Option, Result } from "@carbonteq/fp";
import { DateTime } from "@domain/utils/value-objects";
import type {
	CreateEntity,
	IEntity,
	Serialized,
} from "src/domain/shared/base.entity";
import {
	DocumentId,
	DocumentVersionId,
	MimeType,
	UserId,
} from "src/domain/utils/refined-types";
import { AggregateRoot } from "../shared/aggregate-root.entity";
import type { DocumentStatus } from "./document.enums";
import { DocumentVersion } from "./document-version.entity";

/**
 * Domain interface for the Document aggregate root.
 * Represents the logical anchor — the "file" as a concept.
 * Technical details (size, checksum) live in DocumentVersion.
 */
export interface IDocument extends IEntity<DocumentId> {
	readonly name: string;
	readonly description: Option<string>;
	readonly ownerId: UserId;
	/** URL-friendly identifier, unique per workspace. */
	readonly slug: string;
	/** The MIME type of the document's current/latest version. */
	readonly mimeType: MimeType;
	/** Lifecycle status of the document. Replaces the old `isArchived` boolean. */
	readonly status: DocumentStatus;
	/** FK to the current latest DocumentVersion. Null until the first version is uploaded. */
	readonly latestVersionId: Option<DocumentVersionId>;
	/**
	 * Flexible key-value metadata for advanced search and tagging.
	 * e.g. `{ "department": "finance", "tags": ["Q1", "report"] }`
	 */
	readonly metadata: Option<Record<string, unknown>>;
	/** Collection of associated versions. Part of the aggregate. */
	readonly versions: ReadonlyArray<DocumentVersion>;
}

/**
 * Wire format for Document — all domain types flattened to primitives.
 */
export type SerializedDocument = Serialized<IDocument>;

export class Document extends AggregateRoot<DocumentId> implements IDocument {
	readonly name: string;
	readonly description: Option<string>;
	readonly ownerId: UserId;
	readonly slug: string;
	readonly mimeType: MimeType;
	readonly status: DocumentStatus;
	readonly latestVersionId: Option<DocumentVersionId>;
	readonly metadata: Option<Record<string, unknown>>;
	private _versions: DocumentVersion[];

	get versions(): ReadonlyArray<DocumentVersion> {
		return this._versions;
	}

	private constructor(data: IDocument) {
		super(data);
		this.name = data.name;
		this.description = data.description;
		this.ownerId = data.ownerId;
		this.slug = data.slug;
		this.mimeType = data.mimeType;
		this.status = data.status;
		this.latestVersionId = data.latestVersionId;
		this.metadata = data.metadata;
		this._versions = [...data.versions];
	}

	/**
	 * Factory: creates a new Document with a generated ID and timestamps.
	 */
	static create(
		data: CreateEntity<Omit<IDocument, "versions">> & {
			versions?: ReadonlyArray<DocumentVersion>;
		},
	): Result<Document, Error> {
		const now = DateTime.now();
		return Result.Ok(
			new Document({
				...data,
				id: DocumentId.init(),
				versions: data.versions || [],
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	/**
	 * Factory: rehydrates a Document from its serialized (persistence) form.
	 */
	static fromSerialized(raw: SerializedDocument): Document {
		const versions = (raw.versions || []).map((v) =>
			DocumentVersion.fromSerialized(v as any),
		);

		return new Document({
			id: DocumentId.fromTrusted(raw.id),
			name: raw.name,
			description: Option.fromNullable(raw.description),
			ownerId: UserId.fromTrusted(raw.ownerId),
			slug: raw.slug,
			mimeType: MimeType.fromTrusted(raw.mimeType),
			status: raw.status as DocumentStatus,
			latestVersionId: Option.fromNullable(raw.latestVersionId).map(
				DocumentVersionId.fromTrusted,
			),
			metadata: Option.fromNullable(raw.metadata),
			versions,
			createdAt: DateTime.from(raw.createdAt),
			updatedAt: DateTime.from(raw.updatedAt),
		});
	}

	serialize(): SerializedDocument {
		return {
			...this._serialize(),
			name: this.name,
			description: this.description.safeUnwrap(),
			ownerId: UserId.toString(this.ownerId),
			slug: this.slug,
			mimeType: MimeType.toString(this.mimeType),
			status: this.status,
			latestVersionId: this.latestVersionId.safeUnwrap() as any,
			metadata: this.metadata.safeUnwrap(),
			versions: this.versions.map((v) => v.serialize()) as any,
		} as SerializedDocument;
	}

	/**
	 * Add a new version to the document, updating the latest version info.
	 */
	addVersion(version: DocumentVersion): void {
		this._versions.push(version);
		// @ts-expect-error - allowing internal mutation for aggregate consistency
		this.latestVersionId = Option.Some(version.id);
		// @ts-expect-error
		this.mimeType = version.mimeType;
		// @ts-expect-error
		this.updatedAt = DateTime.now();
	}
}
