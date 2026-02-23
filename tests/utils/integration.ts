import { describe } from "vitest";

const shouldRunIntegration =
	process.env.RUN_INT_TESTS === "1" || process.env.RUN_INT_TESTS === "true";

export const describeIntegration = shouldRunIntegration
	? describe
	: describe.skip;
