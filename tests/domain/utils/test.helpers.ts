/**
 * TestPatterns — safe helpers for unwrapping domain types in tests.
 *
 * Mirrors the company testing standard's `TestPatterns` utility.
 * Provides type-safe helpers for Result (from @carbonteq/fp) and Option types.
 */

import type { Option, Result } from "@carbonteq/fp";

export const TestPatterns = {
	/**
	 * Helpers for Result<T, E> (from @carbonteq/fp).
	 */
	Result: {
		/**
		 * Asserts the Result is Ok and returns the inner value.
		 * Throws a descriptive error if the Result is Err.
		 */
		expectOk<T, E extends Error>(result: Result<T, E>): T {
			if (result.isErr()) {
				throw new Error(
					`Expected Result.Ok but got Result.Err: ${result.unwrapErr().message}`,
				);
			}
			return result.unwrap();
		},

		/**
		 * Asserts the Result is Err and returns the inner error.
		 * Throws a descriptive error if the Result is Ok.
		 */
		expectErr<T, E extends Error>(result: Result<T, E>): E {
			if (result.isOk()) {
				throw new Error(
					`Expected Result.Err but got Result.Ok: ${JSON.stringify(result.unwrap())}`,
				);
			}
			return result.unwrapErr();
		},
	},

	/**
	 * Helpers for Option<T> (from @carbonteq/fp).
	 */
	Option: {
		/**
		 * Asserts the Option is Some and returns the inner value.
		 * Throws a descriptive error if the Option is None.
		 */
		expectSome<T>(option: Option<T>): T {
			if (option.isNone()) {
				throw new Error("Expected Option.Some but got Option.None");
			}
			return option.unwrap();
		},

		/**
		 * Asserts the Option is None.
		 * Throws a descriptive error if the Option is Some.
		 */
		expectNone<T>(option: Option<T>): void {
			if (option.isSome()) {
				throw new Error(
					`Expected Option.None but got Option.Some: ${JSON.stringify(option.unwrap())}`,
				);
			}
		},
	},
};
