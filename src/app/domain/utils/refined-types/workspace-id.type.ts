import { createRefinedType } from '@carbonteq/refined-type';
import * as z from 'zod';
import { Result } from '@carbonteq/fp';

/**
 * Workspace ID format:
 * - Normalized to lowercase UUID
 */
export const WorkspaceIdType = createRefinedType(
  'WorkspaceId',
  z.string().uuid().toLowerCase()
);

export type WorkspaceId = typeof WorkspaceIdType.$infer;

export const WorkspaceId = {
  /**
   * Creates a Workspace ID from a string value.
   * Normalizes to lowercase and validates UUID format.
   */
  create(value: string): Result<WorkspaceId, Error> {
    const normalized = value.trim().toLowerCase();
    const result = WorkspaceIdType.create(normalized);
    if (result.isErr()) {
      return Result.Err(new Error(`Invalid WorkspaceId: ${value}`));
    }
    return result;
  },

  from(value: string): WorkspaceId {
    const result = this.create(value);
    if (result.isErr()) throw result.unwrapErr();
    return result.unwrap();
  },

  /**
   * Creates a Workspace ID from a trusted source (e.g., database).
   * Assumes the value is already validated and normalized.
   * Use with caution - only for values you're certain are valid.
   */
  fromTrusted(value: string): WorkspaceId {
    return value.toLowerCase() as WorkspaceId;
  },

  /**
   * Returns the string representation of the Workspace ID.
   */
  toString(id: WorkspaceId): string {
    return id;
  },
};
