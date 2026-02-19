import { Result } from '@carbonteq/fp';
import { DocumentVersionId, DocumentId, UserId, MimeType, StorageKey, Checksum } from "src/domain/utils/refined-types";
import { DateTime } from 'src/domain/value-objects/date-time.vo';
import { BaseEntity, Serialized, IEntity, CreateEntity } from 'src/domain/shared/base.entity';

/**
 * Domain interface for DocumentVersion.
 * Immutable — rows are never updated, only inserted.
 * Holds all the technical DNA of a specific file upload.
 */
export interface IDocumentVersion extends IEntity<DocumentVersionId> {
  readonly documentId: DocumentId;
  readonly versionNumber: number;
  readonly storageKey: StorageKey;
  readonly mimeType: MimeType;
  readonly fileSize: number;
  readonly checksum: Checksum;
  readonly createdBy: UserId;
}

/**
 * Wire format for DocumentVersion — all domain types flattened to primitives.
 */
export type SerializedDocumentVersion = Serialized<IDocumentVersion>;

export class DocumentVersion extends BaseEntity<DocumentVersionId> implements IDocumentVersion {
  readonly documentId: DocumentId;
  readonly versionNumber: number;
  readonly storageKey: StorageKey;
  readonly mimeType: MimeType;
  readonly fileSize: number;
  readonly checksum: Checksum;
  readonly createdBy: UserId;

  private constructor(data: IDocumentVersion) {
    super(data);
    this.documentId = data.documentId;
    this.versionNumber = data.versionNumber;
    this.storageKey = data.storageKey;
    this.mimeType = data.mimeType;
    this.fileSize = data.fileSize;
    this.checksum = data.checksum;
    this.createdBy = data.createdBy;
  }

  /**
   * Factory: creates a new DocumentVersion with a generated ID.
   * updatedAt mirrors createdAt since versions are immutable.
   */
  static create(data: CreateEntity<IDocumentVersion>): Result<DocumentVersion, Error> {
    const now = DateTime.now();
    return Result.Ok(
      new DocumentVersion({
        ...data,
        id: DocumentVersionId.init(),
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Factory: rehydrates a DocumentVersion from its serialized (persistence) form.
   */
  static fromSerialized(raw: SerializedDocumentVersion): DocumentVersion {
    return new DocumentVersion({
      id: DocumentVersionId.fromTrusted(raw.id),
      documentId: DocumentId.fromTrusted(raw.documentId),
      versionNumber: raw.versionNumber,
      storageKey: StorageKey.fromTrusted(raw.storageKey),
      mimeType: MimeType.fromTrusted(raw.mimeType),
      fileSize: Number(raw.fileSize),
      checksum: Checksum.fromTrusted(raw.checksum),
      createdBy: UserId.fromTrusted(raw.createdBy),
      createdAt: DateTime.from(raw.createdAt),
      updatedAt: DateTime.from(raw.updatedAt),
    });
  }

  serialize(): SerializedDocumentVersion {
    return {
      ...this._serialize(),
      documentId: DocumentId.toString(this.documentId),
      versionNumber: this.versionNumber,
      storageKey: StorageKey.toString(this.storageKey),
      mimeType: MimeType.toString(this.mimeType),
      fileSize: this.fileSize,
      checksum: Checksum.toString(this.checksum),
      createdBy: UserId.toString(this.createdBy),
    };
  }
}
