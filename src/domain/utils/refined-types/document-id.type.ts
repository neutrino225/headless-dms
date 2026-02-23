import { Result } from "@carbonteq/fp";
import { createRefinedType } from "@carbonteq/refined-type";
import * as z from "zod";

/**
 * Document ID format:
 * - Normalized to lowercase UUID
 */
export const DocumentIdType = createRefinedType(
	"DocumentId",
	z.string().uuid().toLowerCase(),
);

export type DocumentId = typeof DocumentIdType.$infer;

export const DocumentId = {
	/**
	 * Generates a new random DocumentId.
	 */
	init(): DocumentId {
		return crypto.randomUUID().toLowerCase() as DocumentId;
	},

	/**
	 * Creates a Document ID from a string value.
	 * Normalizes to lowercase and validates UUID format.
	 */
	create(value: string): Result<DocumentId, Error> {
		const normalized = value.trim().toLowerCase();
		const result = DocumentIdType.create(normalized);
		if (result.isErr()) {
			return Result.Err(new Error(`Invalid DocumentId: ${value}`));
		}
		return result;
	},

	from(value: string): DocumentId {
		const result = this.create(value);
		if (result.isErr()) throw result.unwrapErr();
		return result.unwrap();
	},

	/**
	 * Creates a Document ID from a trusted source (e.g., database).
	 * Assumes the value is already validated and normalized.
	 * Use with caution - only for values you're certain are valid.
	 */
	fromTrusted(value: string): DocumentId {
		return value.toLowerCase() as DocumentId;
	},

	/**
	 * Returns the string representation of the Document ID.
	 */
	toString(id: DocumentId): string {
		return id;
	},
};
