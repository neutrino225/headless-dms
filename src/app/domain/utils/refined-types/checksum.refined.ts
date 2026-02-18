import { createRefinedType } from '@carbonteq/refined-type';
import * as z from 'zod';
import { Result } from '@carbonteq/fp';

/**
 * Checksum format:
 * - Minimum length: 32 characters
 * - Maximum length: 64 characters
 */
export const ChecksumType = createRefinedType(
  'Checksum',
  z.string().min(32, 'Checksum must be at least 32 characters long').max(64, 'Checksum must be at most 64 characters long')
);

export type Checksum = typeof ChecksumType.$infer;

export const Checksum = {
  /**
   * Creates a Checksum from a string value.
   * Validates length requirements.
   */
  create(value: string): Result<Checksum, Error> {
    const normalized = value.trim();
    const result = ChecksumType.create(normalized);
    if (result.isErr()) {
      return Result.Err(new Error(`Invalid Checksum: ${value}`));
    }
    return result;
  },

  from(value: string): Checksum {
    const result = this.create(value);
    if (result.isErr()) throw result.unwrapErr();
    return result.unwrap();
  },

  /**
   * Creates a Checksum from a trusted source (e.g., database).
   * Assumes the value is already validated.
   * Use with caution - only for values you're certain are valid.
   */
  fromTrusted(value: string): Checksum {
    return value as Checksum;
  },

  /**
   * Returns the string representation of the Checksum.
   */
  toString(checksum: Checksum): string {
    return checksum;
  },
};