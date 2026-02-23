import * as S from "@effect/schema/Schema";

/**
 * DateTime Value Object
 * Encapsulates a Date instance with immutability and value equality.
 */
export class DateTime extends S.Class<DateTime>("DateTime")({
	value: S.Date,
}) {
	/**
	 * Creates a DateTime representing the current moment.
	 */
	static now() {
		return new DateTime({ value: new Date() });
	}

	/**
	 * Creates a DateTime from a native Date object.
	 */
	static fromDate(date: Date) {
		return new DateTime({ value: date });
	}

	/**
	 * Creates a DateTime from an ISO string or timestamp.
	 * Throws if the input is invalid.
	 */
	static from(value: string | number | Date): DateTime {
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) {
			throw new Error(`Invalid DateTime: ${value}`);
		}
		return new DateTime({ value: date });
	}

	/**
	 * Returns the ISO string representation of the DateTime.
	 */
	toISOString() {
		return this.value.toISOString();
	}

	/**
	 * Returns the underlying native Date object.
	 */
	toDate() {
		return this.value;
	}

	/**
	 * Checks if this DateTime is before another.
	 */
	isBefore(other: DateTime) {
		return this.value.getTime() < other.value.getTime();
	}

	/**
	 * Checks if this DateTime is after another.
	 */
	isAfter(other: DateTime) {
		return this.value.getTime() > other.value.getTime();
	}
}
