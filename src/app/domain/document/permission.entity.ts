import { Result } from '@carbonteq/fp';
import { UUID } from "@domain/utils/refined-types";
import { DateTime } from '@domain/value-objects/date-time.vo';
import { BaseEntity, Serialized, IEntity, CreateEntity } from '@domain/shared/base.entity';
import { AccessLevel } from './document.enums';

export interface IPermission extends IEntity {
  readonly documentId: UUID;
  readonly userId: UUID;
  readonly accessLevel: AccessLevel;
}

export type SerializedPermission = Serialized<IPermission>;

export class Permission extends BaseEntity implements IPermission {
  readonly documentId: UUID;
  readonly userId: UUID;
  readonly accessLevel: AccessLevel;

  private constructor(data: IPermission) {
    super(data);
    this.documentId = data.documentId;
    this.userId = data.userId;
    this.accessLevel = data.accessLevel;
  }

  static create(data: CreateEntity<IPermission>): Result<Permission, Error> {
    return Result.Ok(
      new Permission({
        ...data,
        id: UUID.init(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      })
    );
  }

  static fromSerialized(raw: SerializedPermission): Permission {
    return new Permission({
      id: UUID.fromTrusted(raw.id),
      documentId: UUID.fromTrusted(raw.documentId),
      userId: UUID.fromTrusted(raw.userId),
      accessLevel: raw.accessLevel as AccessLevel,
      createdAt: DateTime.from(raw.createdAt),
      updatedAt: DateTime.from(raw.updatedAt),
    });
  }

  serialize(): SerializedPermission {
    return {
      ...this._serialize(),
      documentId: UUID.toString(this.documentId),
      userId: UUID.toString(this.userId),
      accessLevel: this.accessLevel,
    };
  }
}
