import { createRefinedType } from '@carbonteq/refined-type';
import * as z from 'zod';
import { Result } from '@carbonteq/fp';

/**
 * User ID format:
 * - Normalized to lowercase UUID
 */
export const UserIdType = createRefinedType(
  'UserId',
  z.string().uuid().toLowerCase()
);

export type UserId = typeof UserIdType.$infer;

export const UserId = {
  /**
   * Generates a new random UserId.
   */
  init(): UserId {
    return crypto.randomUUID().toLowerCase() as UserId;
  },

  /**
   * Creates a User ID from a string value.
   * Normalizes to lowercase and validates UUID format.
   */
  create(value: string): Result<UserId, Error> {
    const normalized = value.trim().toLowerCase();
    const result = UserIdType.create(normalized);
    if (result.isErr()) {
      return Result.Err(new Error(`Invalid UserId: ${value}`));
    }
    return result;
  },

  from(value: string): UserId {
    const result = this.create(value);
    if (result.isErr()) throw result.unwrapErr();
    return result.unwrap();
  },

  /**
   * Creates a User ID from a trusted source (e.g., database).
   * Assumes the value is already validated and normalized.
   * Use with caution - only for values you're certain are valid.
   */
  fromTrusted(value: string): UserId {
    return value.toLowerCase() as UserId;
  },

  /**
   * Returns the string representation of the User ID.
   */
  toString(id: UserId): string {
    return id;
  },
};
