import { ConflictError, NotFoundError, ValidationError } from "@domain/shared/base.errors";

export class DocumentNotFoundError extends NotFoundError {
  readonly code = "DOCUMENT_NOT_FOUND"

  constructor(id: string) {
    super(`Document with ID ${id} not found`)
  }
}

export class DocumentVersionNotFoundError extends NotFoundError {
  readonly code = "DOCUMENT_VERSION_NOT_FOUND"

  constructor(id: string) {
    super(`Document version with ID ${id} not found`)
  }
}


export class DocumentValidationError extends ValidationError {
  readonly code = "DOCUMENT_VALIDATION_ERROR"

  constructor(message: string) {
    super(message)
  }
}

export class DocumentArchivedError extends ConflictError {
  readonly code = "DOCUMENT_ARCHIVED"

  constructor(id: string) {
    super(`Document with ID ${id} is archived`)
  }
}

export class DocumentDeletedError extends ConflictError {
  readonly code = "DOCUMENT_DELETED"

  constructor(id: string) {
    super(`Document with ID ${id} is deleted`)
  }
}

export type DocumentDomainError = 
  | DocumentNotFoundError
  | DocumentVersionNotFoundError
  | DocumentValidationError
  | DocumentArchivedError
  | DocumentDeletedError