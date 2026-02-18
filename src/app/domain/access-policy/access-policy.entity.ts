import { Result } from '@carbonteq/fp';
import { AccessPolicyId, DocumentId, UserId } from "@domain/utils/refined-types";
import { DateTime } from '@domain/value-objects/date-time.vo';
import { BaseEntity, Serialized, IEntity, CreateEntity } from '@domain/shared/base.entity';
import { AccessLevel } from '@domain/document/document.enums';

/**
 * Domain interface for AccessPolicy.
 * Represents a subject-level permission grant:
 * a specific user's access level on a specific document.
 */
export interface IAccessPolicy extends IEntity<AccessPolicyId> {
  readonly documentId: DocumentId;
  readonly userId: UserId;
  readonly accessLevel: AccessLevel;
}

/**
 * Wire format for AccessPolicy — all domain types flattened to primitives.
 */
export type SerializedAccessPolicy = Serialized<IAccessPolicy>;

export class AccessPolicy extends BaseEntity<AccessPolicyId> implements IAccessPolicy {
  readonly documentId: DocumentId;
  readonly userId: UserId;
  readonly accessLevel: AccessLevel;

  private constructor(data: IAccessPolicy) {
    super(data);
    this.documentId = data.documentId;
    this.userId = data.userId;
    this.accessLevel = data.accessLevel;
  }

  /**
   * Factory: creates a new AccessPolicy with a generated ID and timestamps.
   */
  static create(data: CreateEntity<IAccessPolicy>): Result<AccessPolicy, Error> {
    const now = DateTime.now();
    return Result.Ok(
      new AccessPolicy({
        ...data,
        id: AccessPolicyId.init(),
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Factory: rehydrates an AccessPolicy from its serialized (persistence) form.
   */
  static fromSerialized(raw: SerializedAccessPolicy): AccessPolicy {
    return new AccessPolicy({
      id: AccessPolicyId.fromTrusted(raw.id),
      documentId: DocumentId.fromTrusted(raw.documentId),
      userId: UserId.fromTrusted(raw.userId),
      accessLevel: raw.accessLevel as AccessLevel,
      createdAt: DateTime.from(raw.createdAt),
      updatedAt: DateTime.from(raw.updatedAt),
    });
  }

  serialize(): SerializedAccessPolicy {
    return {
      ...this._serialize(),
      documentId: DocumentId.toString(this.documentId),
      userId: UserId.toString(this.userId),
      accessLevel: this.accessLevel,
    };
  }
}
