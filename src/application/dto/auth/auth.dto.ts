import { UserRole } from "@domain/user/user.enums";
import { Schema as S } from "effect";

export const LoginDTOSchema = S.Struct({
	email: S.String,
	password: S.String,
});

export type LoginDTO = S.Schema.Type<typeof LoginDTOSchema>;
export type LoginDTOEncoded = S.Schema.Encoded<typeof LoginDTOSchema>;

export const AuthTokenResponseDTOSchema = S.Struct({
	token: S.String,
	expiresIn: S.Number,
	user: S.Struct({
		id: S.String,
		workspaceId: S.String,
		email: S.String,
		role: S.Enums(UserRole),
	}),
});

export type AuthTokenResponseDTO = S.Schema.Type<
	typeof AuthTokenResponseDTOSchema
>;
