/**
 * Shared utility for running Effect inside oRPC handlers.
 *
 * Converts an Effect computation to a Promise, mapping any
 * domain errors to ORPCError via the error-mapper.
 * Logs errors with correlation context when a logger is provided.
 */

import type { Logger } from "@infra/logger/logger";
import { Cause, Effect as E, Exit, Option } from "effect";
import { mapDomainError } from "../middleware/error-mapper";

/**
 * Run an Effect and translate failures into ORPCError throws.
 *
 * Uses runPromiseExit so that domain errors are thrown directly (not
 * wrapped in Effect's FiberFailure), allowing oRPC to recognise them.
 *
 * When a logger is provided, errors are logged server-side with full
 * detail before the sanitized ORPCError is propagated to the client.
 *
 * Usage: `return runEffect(workflow.method(input), logger)`
 */
export async function runEffect<A>(
	effect: E.Effect<A, unknown>,
	logger?: Logger,
): Promise<A> {
	const exit = await E.runPromiseExit(effect);

	if (Exit.isSuccess(exit)) {
		return exit.value;
	}

	// Extract the typed failure from the Cause (ignores Die / Interrupt)
	const failureOpt = Cause.failureOption(exit.cause);
	const err = Option.isSome(failureOpt)
		? failureOpt.value
		: // Defects / unexpected die — surface as a plain Error
			new Error(Cause.pretty(exit.cause));

	if (logger) {
		const message =
			err instanceof Error ? err.message : "Unknown workflow error";
		const code =
			err != null && typeof err === "object" && "code" in err
				? String((err as Record<string, unknown>).code)
				: undefined;
		logger.error("Workflow error", { errorMessage: message, code });
	}

	throw mapDomainError(err);
}
