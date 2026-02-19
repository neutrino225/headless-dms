import { createRefinedType } from '@carbonteq/refined-type';
import * as z from 'zod';
import { Result } from '@carbonteq/fp';

/**
 * Storage Key format:
 * - Minimum length: 1 character
 * - Maximum length: 255 characters
 */
export const StorageKeyType = createRefinedType(
  'StorageKey',
  z.string().min(1, 'StorageKey must be at least 1 character long').max(255, 'StorageKey must be at most 255 characters long')
);
  
export type StorageKey = typeof StorageKeyType.$infer;

export const StorageKey = {
  /**
   * Creates a Storage Key from a string value.
   * Validates length requirements.
   */
  create(value: string): Result<StorageKey, Error> {
    const normalized = value.trim();
    const result = StorageKeyType.create(normalized);
    if (result.isErr()) {
      return Result.Err(new Error(`Invalid StorageKey: ${value}`));
    }
    return result;
  },

  from(value: string): StorageKey {
    const result = this.create(value);
    if (result.isErr()) throw result.unwrapErr();
    return result.unwrap();
  },

  /**
   * Creates a Storage Key from a trusted source (e.g., database).
   * Assumes the value is already validated.
   * Use with caution - only for values you're certain are valid.
   */
  fromTrusted(value: string): StorageKey {
    return value as StorageKey;
  },

  /**
   * Returns the string representation of the Storage Key.
   */
  toString(key: StorageKey): string {
    return key;
  },
};
