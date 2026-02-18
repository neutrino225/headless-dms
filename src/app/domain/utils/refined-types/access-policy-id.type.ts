import { createRefinedType } from '@carbonteq/refined-type';
import * as z from 'zod';
import { Result } from '@carbonteq/fp';

/**
 * Access Policy ID format:
 * - Normalized to lowercase UUID
 */
export const AccessPolicyIdType = createRefinedType(
  'AccessPolicyId',
  z.string().uuid().toLowerCase()
);

export type AccessPolicyId = typeof AccessPolicyIdType.$infer;

export const AccessPolicyId = {
  /**
   * Generates a new random AccessPolicyId.
   */
  init(): AccessPolicyId {
    return crypto.randomUUID().toLowerCase() as AccessPolicyId;
  },

  /**
   * Creates an Access Policy ID from a string value.
   * Normalizes to lowercase and validates UUID format.
   */
  create(value: string): Result<AccessPolicyId, Error> {
    const normalized = value.trim().toLowerCase();
    const result = AccessPolicyIdType.create(normalized);
    if (result.isErr()) {
      return Result.Err(new Error(`Invalid AccessPolicyId: ${value}`));
    }
    return result;
  },

  from(value: string): AccessPolicyId {
    const result = this.create(value);
    if (result.isErr()) throw result.unwrapErr();
    return result.unwrap();
  },

  /**
   * Creates an Access Policy ID from a trusted source (e.g., database).
   * Assumes the value is already validated and normalized.
   * Use with caution - only for values you're certain are valid.
   */
  fromTrusted(value: string): AccessPolicyId {
    return value.toLowerCase() as AccessPolicyId;
  },

  /**
   * Returns the string representation of the Access Policy ID.
   */
  toString(id: AccessPolicyId): string {
    return id;
  },
};
