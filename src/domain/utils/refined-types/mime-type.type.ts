import { Result } from "@carbonteq/fp";
import { createRefinedType } from "@carbonteq/refined-type";
import * as z from "zod";

/**
 * MIME Type format:
 * - Format: type/subtype
 * - Examples: "text/plain", "image/jpeg", "application/json"
 * - Normalized to lowercase
 * - Maximum length: 127 characters (RFC 6838)
 */
const MIME_TYPE_REGEX = /^[a-z]+\/[a-z0-9][a-z0-9!#$&\-^_.]*$/i;

export const MimeTypeType = createRefinedType(
	"MimeType",
	z
		.string()
		.regex(MIME_TYPE_REGEX, "Invalid MIME type format (expected type/subtype)")
		.max(127, "MIME type must be 127 characters or less")
		.toLowerCase(),
);

export type MimeType = typeof MimeTypeType.$infer;

export const MimeType = {
	/**
	 * Creates a MIME type from a string value.
	 * Normalizes to lowercase and validates format.
	 */
	create(value: string): Result<MimeType, Error> {
		const normalized = value.trim().toLowerCase();
		const result = MimeTypeType.create(normalized);
		if (result.isErr()) {
			return Result.Err(new Error(`Invalid MIME type format: ${value}`));
		}
		return result;
	},

	/**
	 * Creates a MIME type from a trusted source (e.g., database).
	 * Assumes the value is already validated and normalized (lowercase).
	 * Use with caution - only for values you're certain are valid.
	 */
	fromTrusted(value: string): MimeType {
		return value as MimeType;
	},

	toString(mime: MimeType): string {
		return mime;
	},
};
