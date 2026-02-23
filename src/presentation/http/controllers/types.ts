/**
 * Shared types for oRPC procedure builders.
 *
 * The actual inferred type of `os.$context<InitialContext>().use(authMiddleware)`
 * is deeply generic. We use a structural "duck type" so procedure factory
 * functions can accept the builder without coupling to the full generic chain.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProcedureBuilderWithMiddleware = {
	input: (schema: any) => { handler: (fn: any) => any };
	handler: (fn: any) => any;
};
