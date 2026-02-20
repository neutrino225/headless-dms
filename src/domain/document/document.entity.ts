import { Result, Option } from '@carbonteq/fp';
import { DocumentId, DocumentVersionId, UserId, MimeType } from "src/domain/utils/refined-types";
import { DateTime } from '@domain/utils/value-objects';
import { BaseEntity, Serialized, IEntity, CreateEntity } from 'src/domain/shared/base.entity';
import { DocumentStatus } from './document.enums';

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
  readonly latestVersionId:  Option<DocumentVersionId>;
  /**
   * Flexible key-value metadata for advanced search and tagging.
   * e.g. `{ "department": "finance", "tags": ["Q1", "report"] }`
   */
  readonly metadata: Option<Record<string, unknown>>;
}

/**
 * Wire format for Document — all domain types flattened to primitives.
 */
export type SerializedDocument = Serialized<IDocument>;

export class Document extends BaseEntity<DocumentId> implements IDocument {
  readonly name: string;
  readonly description: Option<string>;
  readonly ownerId: UserId;
  readonly slug: string;
  readonly mimeType: MimeType;
  readonly status: DocumentStatus;
  readonly latestVersionId: Option<DocumentVersionId> ;
  readonly metadata: Option<Record<string, unknown>>;

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
  }

  /**
   * Factory: creates a new Document with a generated ID and timestamps.
   */
  static create(data: CreateEntity<IDocument>): Result<Document, Error> {
    const now = DateTime.now();
    return Result.Ok(
      new Document({
        ...data,
        id: DocumentId.init(),
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Factory: rehydrates a Document from its serialized (persistence) form.
   */
  static fromSerialized(raw: SerializedDocument): Document {
    return new Document({
      id: DocumentId.fromTrusted(raw.id),
      name: raw.name,
      description: Option.fromNullable(raw.description),
      ownerId: UserId.fromTrusted(raw.ownerId),
      slug: raw.slug,
      mimeType: MimeType.fromTrusted(raw.mimeType),
      status: raw.status as DocumentStatus,
      latestVersionId: Option.fromNullable(raw.latestVersionId).map(DocumentVersionId.fromTrusted),
      metadata: Option.fromNullable(raw.metadata),
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
      latestVersionId: this.latestVersionId.safeUnwrap(),
      metadata: this.metadata.safeUnwrap(),
    };
  }
}