import "reflect-metadata";

import { User, IUser } from "@domain/user/user.entity";
import {
    EmailAlreadyTakenError,
    UserAlreadyExistsError,
    UserNotFoundError,
} from "@domain/user/user.errors";
import { Email } from "@domain/utils";
import { TOKENS } from "@infra/di/container/tokens";
import { inject, injectable } from "tsyringe";
import { UserRepository } from "@domain/user/user.repository";
import { Effect as E, Schema as S } from "effect";
import {
    CreateUserDTOEncoded,
    CreateUserDTOSchema,
    UpdateUserDTOEncoded,
    UpdateUserDTOSchema,
    RemoveUserDTOEncoded,
    RemoveUserDTOSchema,
} from "@application/dto/user/user.dto";
import { fromResult, unwrapOption, repoCall } from "@application/workflow/workflow.utils";
import { CreateEntity } from "@domain/shared/base.entity";

type CreateUserError = Error | UserAlreadyExistsError | EmailAlreadyTakenError;
type UpdateUserError = Error | UserNotFoundError;
type DeleteUserError = Error | UserNotFoundError;
type GetUserError = Error | UserNotFoundError;

@injectable()
export class UserWorkflows {
    constructor(
        @inject(TOKENS.UserRepository)
        private readonly userRepository: UserRepository,
    ) {}

    createUser(input: CreateUserDTOEncoded): E.Effect<User, CreateUserError> {
        return S.decodeUnknown(CreateUserDTOSchema)(input).pipe(
            E.mapError(() => new Error("Validation failed") as CreateUserError),
            E.flatMap((dto) =>
                fromResult(Email.create(dto.email)).pipe(
                    E.map(
                        (email): CreateEntity<IUser> => ({
                            email,
                            role: dto.role,
                            passwordHash: dto.passwordHash,
                            displayName: dto.displayName ?? null,
                            isActive: dto.isActive,
                        }),
                    ),
                    E.flatMap((data) => fromResult(User.create(data))),
                    E.flatMap((user) =>
                        repoCall(() => this.userRepository.insert(user)).pipe(
                            E.flatMap((opt) =>
                                unwrapOption(opt, new Error("Insert returned no user")),
                            ),
                        ),
                    ),
                ),
            ),
        );
    }

    updateUser(input: UpdateUserDTOEncoded): E.Effect<User, UpdateUserError> {
        return S.decodeUnknown(UpdateUserDTOSchema)(input).pipe(
            E.mapError(() => new Error("Validation failed") as UpdateUserError),
            E.flatMap((dto) =>
                repoCall(() => this.userRepository.fetchById(dto.id)).pipe(
                    E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(dto.id))),
                    E.map((existing) => {
                        const serialized = existing.serialize();
                        return User.fromSerialized({
                            ...serialized,
                            email: dto.email ?? serialized.email,
                            role: dto.role ?? serialized.role,
                            passwordHash: dto.passwordHash ?? serialized.passwordHash,
                            displayName: dto.displayName ?? serialized.displayName,
                            isActive: dto.isActive ?? serialized.isActive,
                            updatedAt: new Date().toISOString(),
                        });
                    }),
                    E.flatMap((updated) =>
                        repoCall(() => this.userRepository.update(updated)).pipe(
                            E.flatMap((opt) =>
                                unwrapOption(opt, new UserNotFoundError(dto.id)),
                            ),
                        ),
                    ),
                ),
            ),
        );
    }

    deleteUser(input: RemoveUserDTOEncoded): E.Effect<User, DeleteUserError> {
        return S.decodeUnknown(RemoveUserDTOSchema)(input).pipe(
            E.mapError(() => new Error("Validation failed") as DeleteUserError),
            E.flatMap((dto) =>
                repoCall(() => this.userRepository.delete(dto.id)).pipe(
                    E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(dto.id))),
                ),
            ),
        );
    }

    getUserById(id: string): E.Effect<User, GetUserError> {
        return repoCall(() => this.userRepository.fetchById(id)).pipe(
            E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(id))),
        );
    }

    getUserByEmail(email: string): E.Effect<User, GetUserError> {
        return repoCall(() => this.userRepository.fetchByEmail(email)).pipe(
            E.flatMap((opt) => unwrapOption(opt, new UserNotFoundError(email))),
        );
    }
}

