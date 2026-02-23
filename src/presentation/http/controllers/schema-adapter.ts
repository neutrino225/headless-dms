/**
 * Schema adapter for oRPC.
 *
 * oRPC requires input schemas to implement the Standard Schema V1 protocol
 * (`~standard` property).  Effect Schemas don't implement it natively in v3.x,
 * but `S.standardSchemaV1()` produces a wrapper that does.
 *
 * This module re-exports a tiny helper so every procedure file doesn't
 * have to import & call the conversion itself.
 */

import { Schema as S } from "effect";

/**
 * Wraps an Effect Schema so it satisfies the StandardSchemaV1 interface
 * expected by oRPC's `.input()` method.
 */
export const toStandard = S.standardSchemaV1;
