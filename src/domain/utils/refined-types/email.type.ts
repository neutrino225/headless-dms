import { Result } from "@carbonteq/fp";
import { createRefinedType } from "@carbonteq/refined-type";
import * as z from "zod";

/**
 * Email format:
 * - Validates email format using Zod
 * - Normalized to lowercase
 * - Maximum length: 254 characters
 */
export const EmailType = createRefinedType(
	"Email",
	z
		.email("Invalid email format")
		.max(254, "Email must be 254 characters or less")
		.toLowerCase(),
);

export type Email = typeof EmailType.$infer;

export const Email = {
	/**
	 * Creates an email from a string value.
	 * Normalizes to lowercase and validates format.
	 */
	create(value: string): Result<Email, Error> {
		const normalized = value.trim().toLowerCase();
		const result = EmailType.create(normalized);
		if (result.isErr()) {
			return Result.Err(new Error(`Invalid email format: ${value}`));
		}
		return result;
	},

	/**
	 * Creates an email from a trusted source (e.g., database).
	 * Assumes the value is already validated and normalized (lowercase).
	 * Use with caution - only for values you're certain are valid.
	 */
	fromTrusted(value: string): Email {
		return value as Email;
	},

	/**
	 * Returns the string representation of the email.
	 */
	toString(email: Email): string {
		return email;
	},
};
