import { NotFoundError, ValidationError, UnauthorizedError } from "@domain/shared/base.errors";

export class UserNotFoundError extends NotFoundError {
  readonly code = "USER_NOT_FOUND";

  constructor(id: string) {
    super(`User with ID ${id} not found`);
  }
}

export class UserValidationError extends ValidationError {
  readonly code = "USER_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
  }
}

export class UserAlreadyExistsError extends ValidationError {
  readonly code = "USER_ALREADY_EXISTS";

  constructor(id: string) {
    super(`User with ID ${id} already exists`);
  }
}

export class UserUnauthorizedError extends UnauthorizedError {
  readonly code = "USER_UNAUTHORIZED";

  constructor(message: string) {
    super(message);
  }
}

export class EmailAlreadyTakenError extends ValidationError {
  readonly code = "EMAIL_ALREADY_TAKEN";

  constructor(email: string) {
    super(`Email ${email} is already taken`);
  }
}

export type UserDomainError =
  | UserNotFoundError
  | UserValidationError
  | UserUnauthorizedError
  | EmailAlreadyTakenError
  | UserAlreadyExistsError;