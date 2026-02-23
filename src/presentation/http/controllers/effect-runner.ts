/**
 * Shared utility for running Effect inside oRPC handlers.
 *
 * Converts an Effect computation to a Promise, mapping any
 * domain errors to ORPCError via the error-mapper.
 * Logs errors with correlation context when a logger is provided.
 */

import type { Logger } from "@infra/logger/logger";
import { Effect as E } from "effect";
import { mapDomainError } from "../middleware/error-mapper";

/**
 * Run an Effect and translate failures into ORPCError throws.
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
	return E.runPromise(
		E.catchAll(effect, (err) => {
			if (logger) {
				const message =
					err instanceof Error ? err.message : "Unknown workflow error";
				const code =
					err instanceof Error && "code" in err
						? (err as Error & { code: string }).code
						: undefined;
				logger.error("Workflow error", { errorMessage: message, code });
			}
			return E.fail(mapDomainError(err));
		}),
	);
}
