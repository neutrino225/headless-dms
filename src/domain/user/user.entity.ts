import { Result } from '@carbonteq/fp';
import { UserId, Email } from "src/domain/utils/refined-types";
import { DateTime } from '@domain/utils/value-objects';
import { BaseEntity, Serialized, IEntity, CreateEntity } from 'src/domain/shared/base.entity';
import { UserRole } from './user.enums';

/**
 * Domain interface for User.
 *
 * `passwordHash` is the bcrypt hash of the user's password.
 * The raw password never lives in the domain — only the hash.
 */
export interface IUser extends IEntity<UserId> {
  readonly email: Email;
  readonly role: UserRole;
  readonly passwordHash: string;
  /** Optional display name shown in the UI. Null if not set. */
  readonly displayName: string | null;
  /** Whether the account is active. Inactive users cannot log in. */
  readonly isActive: boolean;
}

/**
 * Wire format for User — all domain types flattened to primitives.
 */
export type SerializedUser = Serialized<IUser>;

export class User extends BaseEntity<UserId> implements IUser {
  readonly email: Email;
  readonly role: UserRole;
  readonly passwordHash: string;
  readonly displayName: string | null;
  readonly isActive: boolean;

  private constructor(data: IUser) {
    super(data);
    this.email = data.email;
    this.role = data.role;
    this.passwordHash = data.passwordHash;
    this.displayName = data.displayName;
    this.isActive = data.isActive;
  }

  /**
   * Factory: creates a new User with a generated ID and timestamps.
   * Caller is responsible for hashing the password before passing it in.
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
      passwordHash: raw.passwordHash,
      displayName: raw.displayName ?? null,
      isActive: raw.isActive,
      createdAt: DateTime.from(raw.createdAt),
      updatedAt: DateTime.from(raw.updatedAt),
    });
  }

  serialize(): SerializedUser {
    return {
      ...this._serialize(),
      email: Email.toString(this.email),
      role: this.role,
      passwordHash: this.passwordHash,
      displayName: this.displayName,
      isActive: this.isActive,
    };
  }
}
