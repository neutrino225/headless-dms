/**
 * Effect test utilities for running Effect programs in test context.
 *
 * Provides helpers to run Effect effects and assert their results in Vitest.
 */

import { Effect as E, Exit } from "effect";

/**
 * Run an Effect program and return its success value.
 * Throws if the Effect fails.
 */
export async function runEffect<A, Err>(effect: E.Effect<A, Err>): Promise<A> {
	return E.runPromise(effect);
}

/**
 * Run an Effect program and expect it to succeed.
 * Returns the success value for further assertions.
 */
export async function expectEffectSuccess<A, Err>(
	effect: E.Effect<A, Err>,
): Promise<A> {
	const exit = await E.runPromiseExit(effect);
	if (Exit.isFailure(exit)) {
		const cause = exit.cause;
		throw new Error(
			`Expected Effect to succeed, but it failed: ${JSON.stringify(cause)}`,
		);
	}
	return exit.value;
}

/**
 * Run an Effect program and expect it to fail.
 * Returns the error for further assertions.
 */
export async function expectEffectFailure<A, Err>(
	effect: E.Effect<A, Err>,
): Promise<Err> {
	const exit = await E.runPromiseExit(effect);
	if (Exit.isSuccess(exit)) {
		throw new Error(
			`Expected Effect to fail, but it succeeded with: ${JSON.stringify(exit.value)}`,
		);
	}
	// Extract the failure from the cause
	const cause = exit.cause;
	// Effect's Cause can be Fail, Die, Interrupt, etc.
	// For our use cases, we get the first failure
	if ("_tag" in cause && cause._tag === "Fail") {
		return (cause as any).error as Err;
	}
	throw new Error(`Expected a Fail cause but got: ${JSON.stringify(cause)}`);
}
