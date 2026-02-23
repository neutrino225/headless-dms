import { Result } from "@carbonteq/fp";
import { createRefinedType } from "@carbonteq/refined-type";
import * as z from "zod";

/**
 * Document Version ID format:
 * - Normalized to lowercase UUID
 */
export const DocumentVersionIdType = createRefinedType(
	"DocumentVersionId",
	z.string().uuid().toLowerCase(),
);

export type DocumentVersionId = typeof DocumentVersionIdType.$infer;

export const DocumentVersionId = {
	/**
	 * Generates a new random DocumentVersionId.
	 */
	init(): DocumentVersionId {
		return crypto.randomUUID().toLowerCase() as DocumentVersionId;
	},

	/**
	 * Creates a Document Version ID from a string value.
	 * Normalizes to lowercase and validates UUID format.
	 */
	create(value: string): Result<DocumentVersionId, Error> {
		const normalized = value.trim().toLowerCase();
		const result = DocumentVersionIdType.create(normalized);
		if (result.isErr()) {
			return Result.Err(new Error(`Invalid DocumentVersionId: ${value}`));
		}
		return result;
	},

	from(value: string): DocumentVersionId {
		const result = this.create(value);
		if (result.isErr()) throw result.unwrapErr();
		return result.unwrap();
	},

	/**
	 * Creates a Document Version ID from a trusted source (e.g., database).
	 * Assumes the value is already validated and normalized.
	 * Use with caution - only for values you're certain are valid.
	 */
	fromTrusted(value: string): DocumentVersionId {
		return value.toLowerCase() as DocumentVersionId;
	},

	/**
	 * Returns the string representation of the Document Version ID.
	 */
	toString(id: DocumentVersionId): string {
		return id;
	},
};
