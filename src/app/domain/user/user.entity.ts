import { Result } from '@carbonteq/fp';
import { UserId, Email } from "@domain/utils/refined-types";
import { DateTime } from '@domain/value-objects/date-time.vo';
import { BaseEntity, Serialized, IEntity, CreateEntity } from '@domain/shared/base.entity';
import { UserRole } from './user.enums';

/**
 * Domain interface for User.
 */
export interface IUser extends IEntity<UserId> {
  readonly email: Email;
  readonly role: UserRole;
}

/**
 * Wire format for User — all domain types flattened to primitives.
 */
export type SerializedUser = Serialized<IUser>;

export class User extends BaseEntity<UserId> implements IUser {
  readonly email: Email;
  readonly role: UserRole;

  private constructor(data: IUser) {
    super(data);
    this.email = data.email;
    this.role = data.role;
  }

  /**
   * Factory: creates a new User with a generated ID and timestamps.
   */
  static create(data: CreateEntity<IUser>): Result<User, Error> {
    const now = DateTime.now();
    return Result.Ok(
      new User({
        ...data,
        id: UserId.init(),
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Factory: rehydrates a User from its serialized (persistence) form.
   */
  static fromSerialized(raw: SerializedUser): User {
    return new User({
      id: UserId.fromTrusted(raw.id),
      email: Email.fromTrusted(raw.email),
      role: raw.role as UserRole,
      createdAt: DateTime.from(raw.createdAt),
      updatedAt: DateTime.from(raw.updatedAt),
    });
  }

  serialize(): SerializedUser {
    return {
      ...this._serialize(),
      email: Email.toString(this.email),
      role: this.role,
    };
  }
}
