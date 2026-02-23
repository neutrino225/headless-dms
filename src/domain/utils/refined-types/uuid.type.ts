import { Result } from "@carbonteq/fp";
import { createRefinedType } from "@carbonteq/refined-type";
import * as z from "zod";

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * UUID format:
 * - Validates standard UUID format using regex
 */
export const UUIDType = createRefinedType(
	"UUID",
	z.string().regex(UUID_REGEX, "Invalid UUID format"),
);

export type UUID = typeof UUIDType.$infer;

export const UUID = {
	/**
	 * Generates a new random UUID.
	 */
	init(): UUID {
		const id = crypto.randomUUID();
		return UUIDType.create(id).unwrap();
	},

	/**
	 * Creates a UUID from a string value.
	 * Validates UUID format.
	 */

	create(value: string): Result<UUID, Error> {
		const normalized = value.trim();
		const result = UUIDType.create(normalized);
		if (result.isErr()) {
			return Result.Err(new Error(`Invalid UUID: ${value}`));
		}
		return result;
	},

	from(value: string): UUID {
		const result = this.create(value);
		if (result.isErr()) throw result.unwrapErr();
		return result.unwrap();
	},

	/**
	 * Creates a UUID from a trusted source (e.g., database).
	 * Assumes the value is already validated.
	 * Use with caution - only for values you're certain are valid.
	 */
	fromTrusted(value: string): UUID {
		return value as UUID;
	},

	/**
	 * Returns the string representation of the UUID.
	 */
	toString(uuid: UUID): string {
		return uuid;
	},
};
