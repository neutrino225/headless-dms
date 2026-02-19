import { Option } from '@carbonteq/fp';

import { UUID } from "src/domain/utils/refined-types"
import { DateTime } from "src/domain/value-objects/date-time.vo"

/**
 * Base interface for all domain entities.
 * Generic over the ID type so each entity can use its own typed ID
 * (e.g., DocumentId, UserId) while still satisfying the base contract.
 */
export interface IEntity<TId extends string = UUID> {
  readonly id: TId;
  readonly createdAt: DateTime;
  readonly updatedAt: DateTime;
}

/**
 * Utility type to derive serialized format from domain interface.
 * Automatically converts domain types to their wire format:
 * - UUID / branded string IDs → string
 * - DateTime → string (ISO 8601 format to avoid timezone issues)
 * - Option<T> → T | null (recursively serialized)
 * - Arrays → recursively serialized
 */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends DateTime
    ? string
    : T[K] extends string
      ? string
      : T[K] extends number
        ? number
        : T[K] extends boolean
          ? boolean
          : T[K] extends Option<infer U>
            ? U extends DateTime
              ? string | null
              : U extends string
                ? string | null
                : Serialized<U> | null
          : T[K] extends (infer U)[]
            ? Serialized<U>[]
            : T[K] extends object
              ? Serialized<T[K]>
              : T[K];
};


/**
 * Utility type for entity creation - omits auto-generated fields
 */
export type CreateEntity<T extends IEntity<string>> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
>;


// We declare the props shape every entity must receive
export interface BaseEntityProps<TId extends string = UUID> {
  readonly id: TId
  readonly createdAt: DateTime
  readonly updatedAt: DateTime
}

export abstract class BaseEntity<TId extends string = UUID> {
  readonly id: TId
  readonly createdAt: DateTime
  readonly updatedAt: DateTime

  protected constructor(props: BaseEntityProps<TId>) {
    this.id = props.id
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  protected _serialize(): { id: string; createdAt: string; updatedAt: string } {
    return {
      id: this.id,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    }
  }

  equals(other: BaseEntity<TId>): boolean {
    return this.id === other.id
  }
}