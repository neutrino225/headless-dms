import { Result } from '@carbonteq/fp';
import { UUID } from "src/domain/utils/refined-types";
import { DateTime } from 'src/domain/value-objects/date-time.vo';
import { BaseEntity, Serialized, IEntity, CreateEntity } from 'src/domain/shared/base.entity';
import { AuditAction } from './audit-log.enums';

export interface IAuditLog extends IEntity {
  readonly userId: UUID;
  readonly action: AuditAction | string;
  readonly resourceId: UUID;
  readonly createdAt: DateTime;
}

export type SerializedAuditLog = Omit<Serialized<IAuditLog>, 'createdAt'> & {
  createdAt: string;
};

export class AuditLog extends BaseEntity implements IAuditLog {
  readonly userId: UUID;
  readonly action: AuditAction | string;
  readonly resourceId: UUID;

  private constructor(data: IAuditLog) {
    super(data);
    this.userId = data.userId;
    this.action = data.action;
    this.resourceId = data.resourceId;
  }

  static create(data: CreateEntity<IAuditLog>): Result<AuditLog, Error> {
    return Result.Ok(
      new AuditLog({
        ...data,
        id: UUID.init(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      })
    );
  }

  static fromSerialized(raw: SerializedAuditLog): AuditLog {
    return new AuditLog({
      id: UUID.fromTrusted(raw.id),
      userId: UUID.fromTrusted(raw.userId),
      action: raw.action,
      resourceId: UUID.fromTrusted(raw.resourceId),
      createdAt: DateTime.from(raw.createdAt),
      updatedAt: DateTime.from(raw.updatedAt),
    });
  }

  serialize(): SerializedAuditLog {
    return {
      ...this._serialize(),
      userId: UUID.toString(this.userId),
      action: this.action,
      resourceId: UUID.toString(this.resourceId),
    };
  }
}
