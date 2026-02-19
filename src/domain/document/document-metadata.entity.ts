import { Result } from '@carbonteq/fp';
import { UUID } from "src/domain/utils/refined-types";
import { DateTime } from 'src/domain/value-objects/date-time.vo';
import { BaseEntity, Serialized, IEntity, CreateEntity } from 'src/domain/shared/base.entity';

export interface IDocumentMetadata extends IEntity {
  readonly documentId: UUID;
  readonly key: string;
  readonly value: string;
}

export type SerializedDocumentMetadata = Serialized<IDocumentMetadata>;

export class DocumentMetadata extends BaseEntity implements IDocumentMetadata {
  readonly documentId: UUID;
  readonly key: string;
  readonly value: string;

  private constructor(data: IDocumentMetadata) {
    super(data);
    this.documentId = data.documentId;
    this.key = data.key;
    this.value = data.value;
  }

  static create(data: CreateEntity<IDocumentMetadata>): Result<DocumentMetadata, Error> {
    return Result.Ok(
      new DocumentMetadata({
        ...data,
        id: UUID.init(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      })
    );
  }

  static fromSerialized(raw: SerializedDocumentMetadata): DocumentMetadata {
    return new DocumentMetadata({
      id: UUID.fromTrusted(raw.id),
      documentId: UUID.fromTrusted(raw.documentId),
      key: raw.key,
      value: raw.value,
      createdAt: DateTime.from(raw.createdAt),
      updatedAt: DateTime.from(raw.updatedAt),
    });
  }

  serialize(): SerializedDocumentMetadata {
    return {
      ...this._serialize(),
      documentId: UUID.toString(this.documentId),
      key: this.key,
      value: this.value,
    };
  }
}
