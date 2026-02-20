import { AccessLevel } from "@domain/document/document.enums";
import { Schema as S } from "effect";

// ─── Commands ─────────────────────────────────────────────────────────────────

export const GrantAccessDTOSchema = S.Struct({
    documentId: S.String,
    userId: S.String,
    accessLevel: S.Enums(AccessLevel),
    grantedBy: S.String,
});

export type GrantAccessDTO = S.Schema.Type<typeof GrantAccessDTOSchema>;
export type GrantAccessDTOEncoded = S.Schema.Encoded<typeof GrantAccessDTOSchema>;

export const UpdateAccessDTOSchema = S.Struct({
    policyId: S.String,
    accessLevel: S.Enums(AccessLevel),
});

export type UpdateAccessDTO = S.Schema.Type<typeof UpdateAccessDTOSchema>;
export type UpdateAccessDTOEncoded = S.Schema.Encoded<typeof UpdateAccessDTOSchema>;

export const RevokeAccessDTOSchema = S.Struct({
    policyId: S.String,
});

export type RevokeAccessDTO = S.Schema.Type<typeof RevokeAccessDTOSchema>;
export type RevokeAccessDTOEncoded = S.Schema.Encoded<typeof RevokeAccessDTOSchema>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export const CheckAccessDTOSchema = S.Struct({
    userId: S.String,
    documentId: S.String,
    action: S.Enums(AccessLevel),
});

export type CheckAccessDTO = S.Schema.Type<typeof CheckAccessDTOSchema>;
export type CheckAccessDTOEncoded = S.Schema.Encoded<typeof CheckAccessDTOSchema>;
