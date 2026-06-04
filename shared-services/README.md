# Shared Services

This directory contains handwritten business logic shared by both generated server implementations.

The purpose of this directory is to keep application logic outside generated code. This makes the project safer to regenerate because changes to generated folders do not overwrite the core service implementation.

## Contents

| Directory | Meaning |
|---|---|
| `src/` | Source code for handwritten shared services. |

The generated projects access this logic through the adapter layer in `adapters/`.

## Relation to the Lab Specifications

The shared service currently implements the Film Manager behavior as five lab-oriented
areas:

| Lab area | Shared-service responsibility |
|---|---|
| Session and status API | Login, logout/current-session behavior, and health checks. |
| Public film catalogue | Public film listing, single public-film reads, and public review reads. |
| Authenticated film management | Owned-film listing, creation, detail reads, updates, and deletion. |
| Review and image workflows | Reviewer invitation/removal, current-review completion, and image metadata operations. |
| Realtime active-film behavior | Online-user snapshot, active-film selection, active-film clearing, and conflict detection when two reviewers select the same film. |

This separation is documentation-level only; the implementation intentionally remains in
one shared in-memory service so both generator experiments exercise the same business
state and the same error rules.
