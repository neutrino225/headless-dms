import { UserRole } from "@domain/user/user.enums";
import { Schema as S } from "effect";

export const CreateUserDTOSchema = S.Struct({
	workspaceId: S.UUID,
	email: S.String,
	role: S.Enums(UserRole),
	password: S.String,
	displayName: S.optional(S.String),
	isActive: S.Boolean,
});

export type CreateUserDTO = S.Schema.Type<typeof CreateUserDTOSchema>;
export type CreateUserDTOEncoded = S.Schema.Encoded<typeof CreateUserDTOSchema>;

export const UpdateUserDTOSchema = CreateUserDTOSchema.pick(
	"email",
	"role",
	"password",
	"displayName",
	"isActive",
)
	.pipe(S.partialWith({ exact: true }))
	.pipe(
		S.extend(
			S.Struct({
				id: S.String,
			}),
		),
	);

export type UpdateUserDTO = S.Schema.Type<typeof UpdateUserDTOSchema>;
export type UpdateUserDTOEncoded = S.Schema.Encoded<typeof UpdateUserDTOSchema>;

export const UserResponseDTOSchema = CreateUserDTOSchema.pick(
	"workspaceId",
	"email",
	"role",
	"displayName",
	"isActive",
).pipe(
	S.extend(
		S.Struct({
			id: S.String,
			createdAt: S.Date,
			updatedAt: S.Date,
		}),
	),
);

export type UserResponseDTO = S.Schema.Type<typeof UserResponseDTOSchema>;
export type UserResponseDTOEncoded = S.Schema.Encoded<
	typeof UserResponseDTOSchema
>;

export const RemoveUserDTOSchema = S.Struct({
	id: S.String,
});

export type RemoveUserDTO = S.Schema.Type<typeof RemoveUserDTOSchema>;
export type RemoveUserDTOEncoded = S.Schema.Encoded<typeof RemoveUserDTOSchema>;

export const GetUserDocumentsDTOSchema = S.Struct({
	userId: S.String,
});

export type GetUserDocumentsDTO = S.Schema.Type<
	typeof GetUserDocumentsDTOSchema
>;
export type GetUserDocumentsDTOEncoded = S.Schema.Encoded<
	typeof GetUserDocumentsDTOSchema
>;
