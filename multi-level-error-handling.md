Best Practices/Backend/Error Handling

# Multi-level Error Handling with Monads

In most real-world (and especially _complex_) codebases, layers are unavoidable.
You’ll almost always end up with something like:

```
Controller -> Service -> Repository
```

Each layer can fail, and if you’re using **monads** (e.g. `Result` / `Either` / `IO`-style computations) you’ll typically model failures as **typed values**, not thrown exceptions.

That’s great… until you let errors propagate _too far_.

If every layer keeps forwarding its own errors _plus_ all errors from below, by the time you reach the controller you end up with a giant union of unrelated infrastructure + domain failures. The types are “correct”, but the system becomes hard to work with.

We’ll establish a simple rule and then show the solution using **pseudo-code only** (comments + types). No class implementations.

* * *

## [The setup: three layers, three responsibilities](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#the-setup-three-layers-three-responsibilities)

- **Repository**: persistence concerns (DB, cache, etc.)
- **Service**: business rules + orchestration
- **Controller**: boundary concerns (parse/validate/auth, map to transport)

The goal: keep error handling **typed** while keeping boundaries **clean**.

* * *

## [The problem: “true typed propagation” makes the top layer messy](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#the-problem-true-typed-propagation-makes-the-top-layer-messy)

Assume a “borrow book”-style flow. We’ll only sketch shapes.

```
// =========================

// Repository (lowest layer)

// =========================

// Repo errors are infrastructure-flavored.

// In real life these come from DB clients, timeouts, pooling, etc.

type RepoError =

  | { _tag: "DbConnectionError"; message: string }

  | { _tag: "DbTimeoutError"; message: string }

  | { _tag: "DbConstraintViolation"; constraint: string }

  | { _tag: "DbUnknown"; message: string }

// Repo functions never throw, they fail with RepoError.

// Not-found is modeled as data (null/Option), not an error.

declare const repoFindBookById: (bookId: string) => Effect.Effect<Book | null, RepoError>

declare const repoFindUserById: (userId: string) => Effect.Effect<User | null, RepoError>

declare const repoCountActiveByUserId: (userId: string) => Effect.Effect<number, RepoError>

declare const repoCreateLending: (input: LendingCreate) => Effect.Effect<void, RepoError>

declare const repoMarkBookUnavailable: (bookId: string) => Effect.Effect<void, RepoError>
```

```
// =========================

// Service (middle layer)

// =========================

// Domain failures (business rules)

type DomainError =

  | { _tag: "BookNotFound"; bookId: string }

  | { _tag: "UserNotFound"; userId: string }

  | { _tag: "BookNotAvailable"; bookId: string }

  | { _tag: "BorrowLimitExceeded"; userId: string; limit: number; current: number }

// Naive approach: just forward RepoError upward

type ServiceError = DomainError | RepoError

declare const borrowBook: (

  bookId: string,

  userId: string

) => Effect.Effect<BorrowResult, ServiceError>

// The union grows because monads compose error channels.
```

```
// =========================

// Controller (top layer)

// =========================

// Controller boundary failures (parse/validation/auth/etc.)

type ControllerError =

  | { _tag: "ParseError"; details: unknown }

  | { _tag: "Unauthorized" }

// Naive approach: controller now sees everything

type ControllerProgramError = ControllerError | ServiceError

declare const handler: (req: Request) => Effect.Effect<Response, ControllerProgramError>
```

Dedicated view of the **accumulation**:

```
// What the controller ends up dealing with:

type ControllerProgramError =

  // boundary errors (controller-level)

  | { _tag: "ParseError"; details: unknown }

  | { _tag: "Unauthorized" }

  // domain errors (service-level)

  | { _tag: "BookNotFound"; bookId: string }

  | { _tag: "UserNotFound"; userId: string }

  | { _tag: "BookNotAvailable"; bookId: string }

  | { _tag: "BorrowLimitExceeded"; userId: string; limit: number; current: number }

  // infra errors (repo-level) — leaking across boundaries

  | { _tag: "DbConnectionError"; message: string }

  | { _tag: "DbTimeoutError"; message: string }

  | { _tag: "DbConstraintViolation"; constraint: string }

  | { _tag: "DbUnknown"; message: string }

// Notice the smell:

// the controller doesn’t talk to the DB, but it still has to “know” DB errors.
```

### [Why this is a problem (even though it’s typed)](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#why-this-is-a-problem-even-though-its-typed)

- **Signature explosion**: the top layer becomes a dumping ground for all stack failures.
- **Leaky abstractions**: DB/driver details leak to layers that shouldn’t care.
- **Refactor pain**: swap a repo implementation and your controller types change.
- **Unclear ownership**: who decides how to translate “DbTimeoutError” to HTTP? It shouldn’t be the controller.

So the real challenge isn’t “how to type errors” — monads already give you that.

The challenge is **where to stop error propagation and reshape errors at boundaries**.

* * *

## [The rule: each layer only knows errors one layer deep](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#the-rule-each-layer-only-knows-errors-one-layer-deep)

> **Rule: each layer should only know errors one layer deep.**

Meaning:

- The **service** may know repository errors (it calls the repo).
- The **controller** may know service errors (it calls the service).
- The **controller must not know repository errors**.

To enforce this, each layer exposes its own error vocabulary and **maps errors from below into that vocabulary**.

* * *

## [The solution: map errors at boundaries (don’t forward them)](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#the-solution-map-errors-at-boundaries-dont-forward-them)

### [Step 1: repository exposes `RepoError` only](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#step-1-repository-exposes-repoerror-only)

```
// Repository speaks infra, and only infra.

type RepoError =

  | { _tag: "DbUnavailable" }

  | { _tag: "DbTimeout" }

  | { _tag: "DbUnknown"; message: string }

declare const repoFindBookById: (bookId: string) => Effect.Effect<Book | null, RepoError>

// ... other repo fns ...
```

### [Step 2: service maps `RepoError` into _service-level_ infra errors](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#step-2-service-maps-repoerror-into-service-level-infra-errors)

The service should not expose DB-shaped failures.
It exposes:

- **DomainError**: business rule failures (expected)
- **ServiceInfraError**: infrastructure failures (unexpected) in a stable service vocabulary

```
type DomainError =

  | { _tag: "BookNotFound"; bookId: string }

  | { _tag: "UserNotFound"; userId: string }

  | { _tag: "BookNotAvailable"; bookId: string }

  | { _tag: "BorrowLimitExceeded"; userId: string; limit: number; current: number }

type ServiceInfraError =

  | { _tag: "ServiceUnavailable"; operation: "borrowBook" }

  | { _tag: "ServiceUnknown"; operation: "borrowBook" }

type ServiceError = DomainError | ServiceInfraError
```

Now the key move: **map** repository errors at the service boundary.

```
declare const borrowBook: (

  bookId: string,

  userId: string

) => Effect.Effect<BorrowResult, ServiceError>

// PSEUDO IMPLEMENTATION (comments only)

const borrowBook = (bookId, userId) =>

  pipe(

    // Repo calls (fail with RepoError)

    Effect.all({

      book: repoFindBookById(bookId),

      user: repoFindUserById(userId),

      activeCount: repoCountActiveByUserId(userId),

    }),

    // Boundary: RepoError must not leak past service

    Effect.mapError((_repoError) => ({ _tag: "ServiceUnavailable", operation: "borrowBook" })),

    // Turn "not found" (null) into domain errors

    Effect.flatMap(({ book, user, activeCount }) =>

      book

        ? Effect.succeed({ book, user, activeCount })

        : Effect.fail({ _tag: "BookNotFound", bookId })

    ),

    Effect.flatMap(({ book, user, activeCount }) =>

      user

        ? Effect.succeed({ book, user, activeCount })

        : Effect.fail({ _tag: "UserNotFound", userId })

    ),

    // More domain checks...

    // - availability

    // - borrow limit

    // More repo work (fails with RepoError again)

    Effect.flatMap(({ book, user }) =>

      pipe(

        repoMarkBookUnavailable(book.id),

        Effect.flatMap(() => repoCreateLending({ bookId: book.id, userId: user.id })),

        // Boundary again: any RepoError becomes ServiceInfraError

        Effect.mapError((_repoError) => ({ _tag: "ServiceUnavailable", operation: "borrowBook" })),

        Effect.map(() => ({

          lendingId: "generated",

          dueDate: "computed",

          bookTitle: book.title,

        }))

      )

    )

  )
```

Result:

- service signature is stable (e.g. `Result<E, A>` / `Either<E, A>` / `Effect<A, E>`)
- controller never sees `RepoError`
- you can swap DB libs without changing controller error handling

### [Step 3: controller maps `ServiceError` into transport errors (HTTP)](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#step-3-controller-maps-serviceerror-into-transport-errors-http)

The controller is the boundary. It should translate:

- parse/validation errors → 400
- domain errors → 404/409/etc
- service infra errors → 500/503

Again: **do not forward lower-level errors**. Map them.

```
type HttpError =

  | { _tag: "BadRequest"; message: string }

  | { _tag: "NotFound"; message: string }

  | { _tag: "Conflict"; message: string }

  | { _tag: "Unavailable"; message: string }

declare const parseRequest: (req: Request) => Effect.Effect<{ bookId: string; userId: string }, { _tag: "ParseError" }>

declare const okJson: (body: unknown) => Response

declare const handler: (req: Request) => Effect.Effect<Response, HttpError>

const handler = (req) =>

  pipe(

    // Boundary failures at controller

    parseRequest(req),

    Effect.mapError((_parseErr) => ({ _tag: "BadRequest", message: "Invalid request" })),

    // Service call: only ServiceError can happen here

    Effect.flatMap(({ bookId, userId }) => borrowBook(bookId, userId)),

    // Boundary: map ServiceError -> HttpError

    Effect.mapError((err: ServiceError) => {

      switch (err._tag) {

        case "BookNotFound":

          return { _tag: "NotFound", message: "Book not found" }

        case "UserNotFound":

          return { _tag: "NotFound", message: "User not found" }

        case "BookNotAvailable":

          return { _tag: "Conflict", message: "Book not available" }

        case "BorrowLimitExceeded":

          return { _tag: "Conflict", message: "Borrow limit exceeded" }

        case "ServiceUnavailable":

        case "ServiceUnknown":

          return { _tag: "Unavailable", message: "Service temporarily unavailable" }

      }

    }),

    // Success -> Response

    Effect.map((result) => okJson(result))

  )
```

Now the handler only knows:

- its own boundary failures
- the service error vocabulary (domain + service infra)

And it **never** learns about repository errors.

* * *

## [What you get with this approach](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads\#what-you-get-with-this-approach)

- **Small, local types**: each layer reasons about its own vocabulary + one layer below.
- **Stable contracts**: lower-layer refactors don’t ripple upward.
- **Clear ownership**: error translation happens at boundaries, not randomly.
- **Cleaner controller code**: no infra leakage, just transport mapping.

[Better Error Handling With Monads\\
\\
Lets analyze why the default error handling approach falls apart at scale and how (Monads) fixes these problems.](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/better-error-handling-with-monads) [Overview\\
\\
A comprehensive guide to backend architecture and design patterns.](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/architecture/overview)

### On this page

[The setup: three layers, three responsibilities](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#the-setup-three-layers-three-responsibilities) [The problem: “true typed propagation” makes the top layer messy](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#the-problem-true-typed-propagation-makes-the-top-layer-messy) [Why this is a problem (even though it’s typed)](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#why-this-is-a-problem-even-though-its-typed) [The rule: each layer only knows errors one layer deep](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#the-rule-each-layer-only-knows-errors-one-layer-deep) [The solution: map errors at boundaries (don’t forward them)](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#the-solution-map-errors-at-boundaries-dont-forward-them) [Step 1: repository exposes `RepoError` only](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#step-1-repository-exposes-repoerror-only) [Step 2: service maps `RepoError` into _service-level_ infra errors](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#step-2-service-maps-repoerror-into-service-level-infra-errors) [Step 3: controller maps `ServiceError` into transport errors (HTTP)](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#step-3-controller-maps-serviceerror-into-transport-errors-http) [What you get with this approach](https://dev-portal-fuma.vercel.app/docs/best-practices/backend/error-handling/multi-level-error-handling-with-monads#what-you-get-with-this-approach)