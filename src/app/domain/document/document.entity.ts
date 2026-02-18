import { Result } from '@carbonteq/fp';
import { DocumentId, UserId } from "@domain/utils/refined-types";
import { DateTime } from '@domain/value-objects/date-time.vo';
import { BaseEntity, Serialized, IEntity, CreateEntity } from '@domain/shared/base.entity';

/**
 * Domain interface for the Document aggregate root.
 * Represents the logical anchor — the "file" as a concept.
 * Technical details (mime type, size, checksum) live in DocumentVersion.
 */
export interface IDocument extends IEntity<DocumentId> {
  readonly name: string;
  readonly ownerId: UserId;
  readonly isArchived: boolean;
}

/**
 * Wire format for Document — all domain types flattened to primitives.
 */
export type SerializedDocument = Serialized<IDocument>;

export class Document extends BaseEntity<DocumentId> implements IDocument {
  readonly name: string;
  readonly ownerId: UserId;
  readonly isArchived: boolean;

  private constructor(data: IDocument) {
    super(data);
    this.name = data.name;
    this.ownerId = data.ownerId;
    this.isArchived = data.isArchived;
  }

  /**
   * Factory: creates a new Document with a generated ID and timestamps.
   */
  static create(data: CreateEntity<IDocument>): Result<Document, Error> {
    return Result.Ok(
      new Document({
        ...data,
        id: DocumentId.init(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
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
      ownerId: UserId.fromTrusted(raw.ownerId),
      isArchived: raw.isArchived,
      createdAt: DateTime.from(raw.createdAt),
      updatedAt: DateTime.from(raw.updatedAt),
    });
  }

  serialize(): SerializedDocument {
    return {
      ...this._serialize(),
      name: this.name,
      ownerId: UserId.toString(this.ownerId),
      isArchived: this.isArchived,
    };
  }
}