import type { Option, Result } from "@carbonteq/fp";
import { Effect as E } from "effect";

/**
 * Bridge a @carbonteq/fp Result into an Effect.
 */
export const fromResult = <T, Err>(result: Result<T, Err>): E.Effect<T, Err> =>
	result.isOk() ? E.succeed(result.unwrap()) : E.fail(result.unwrapErr());

/**
 * Unwrap an Option into an Effect, failing with `error` when None.
 */
export const unwrapOption = <T>(
	opt: Option<T>,
	error: Error,
): E.Effect<T, Error> =>
	opt.isSome() ? E.succeed(opt.unwrap()) : E.fail(error);

/**
 * Wrap an async repository call (returning Promise<Result>) into an Effect.
 * Propagates both thrown exceptions (as Error) and Result errors.
 */
export const repoCall = <T, Err>(
	fn: () => Promise<Result<T, Err>>,
): E.Effect<T, Err | Error> =>
	E.tryPromise({
		try: fn,
		catch: (e): Error => (e instanceof Error ? e : new Error(String(e))),
	}).pipe(E.flatMap((result) => fromResult(result)));
