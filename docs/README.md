# Documentation index

This directory holds the written analysis, per-lab implementation docs,
compliance audit records, and configuration reference for the project. See
the root [`README.md`](../README.md) for the project overview and quick
start.

## Getting started

| Document | Purpose |
|---|---|
| [`run-all-labs.md`](run-all-labs.md) | Canonical end-to-end sequence: install, generate, start every component, run every test, run Postman. |
| [`configuration.md`](configuration.md) | Every environment variable read by the project, with defaults and purpose. |

## Architecture and generator comparison

The core analysis this project is built around — why OpenAPI Generator was
chosen over SwaggerHub, how the adapter pattern keeps handwritten code
regeneration-safe, and how the final template customization works:

| Document | Purpose |
|---|---|
| [`01-swaggerhub-analysis.md`](01-swaggerhub-analysis.md) | Initial SwaggerHub / Swagger Studio evaluation: features, trial-account limits, generated project structure, early conclusions. |
| [`02-experimental-comparison.md`](02-experimental-comparison.md) | Runtime experiment, regeneration behavior, adapter strategy, comparison between the OpenAPI Generator and SwaggerHub workflows. |
| [`03-openapi-generator-options-analysis.md`](03-openapi-generator-options-analysis.md) | OpenAPI Generator configuration options and the final template-customization strategy. |
| [`04-service-url-reference.md`](04-service-url-reference.md) | Film Manager service URLs and smoke-test commands. |
| [`05-success-codes-and-upload-storage.md`](05-success-codes-and-upload-storage.md) | Success-code and persistent-upload-storage design, in non-technical language. |
| [`06-lab01-synchronization.md`](06-lab01-synchronization.md) | Lab01 requirements mapped to the final contract, shared implementation, authentication, and tests. |

## Lab implementation docs (current behavior)

Present-tense documents describing how each lab works today:

| Document | Lab |
|---|---|
| [`06-lab01-synchronization.md`](06-lab01-synchronization.md) | Lab01 — schema, auth, in-memory domain |
| [`lab02-implementation.md`](lab02-implementation.md) | Lab02 — image upload, metadata, gRPC conversion |
| [`../shared-services/lab03/README.md`](../shared-services/lab03/README.md) | Lab03 — TCP image-conversion protocol |
| [`lab04-implementation.md`](lab04-implementation.md) | Lab04 — WebSocket presence and active-film notifications |
| [`lab05-implementation.md`](lab05-implementation.md) | Lab05 — MQTT exclusive active-film selection (supersedes part of Lab04) |

## Historical appendices

Superseded, point-in-time development documents, kept for history. Each
carries a banner pointing to its current replacement.

| Document | Superseded by |
|---|---|
| [`appendix/lab02-phase1-implementation.md`](appendix/lab02-phase1-implementation.md) | [`lab02-implementation.md`](lab02-implementation.md) |
| [`appendix/lab02-phase2-implementation.md`](appendix/lab02-phase2-implementation.md) | [`lab02-implementation.md`](lab02-implementation.md) |
| [`appendix/lab02-phase3-implementation.md`](appendix/lab02-phase3-implementation.md) | [`lab02-implementation.md`](lab02-implementation.md) |

## Compliance audits

Dated, point-in-time audit records verifying specific requirement sets
against the repository state *as it existed when each audit was written*.
They are not living documents — read them alongside the current
implementation doc for the same lab, and treat any git-state claim inside
them (branch, commit, "tracked/not tracked") as historical unless a banner
says otherwise.

| Document | Audited lab | Current implementation doc |
|---|---|---|
| [`lab04-compliance-audit.md`](lab04-compliance-audit.md) | Lab04 | [`lab04-implementation.md`](lab04-implementation.md) |
| [`lab05-compliance-audit.md`](lab05-compliance-audit.md) | Lab05 | [`lab05-implementation.md`](lab05-implementation.md) |

The Lab02 and Lab03 compliance audits (`lab02-compliance-audit.md`,
`lab02-compliance-audit-verification.md`, `lab02-final-compliance-audit.md`,
`lab03-compliance-audit.md`) are **not tracked in git** — they are excluded via
`.gitignore` and exist only in local working trees that happened to create
them, consistent with the Lab01/Lab02 precedent of not committing these
working documents. They are intentionally not linked here because a link to
them would be dead in a fresh clone. See
[`../shared-services/lab03/README.md`](../shared-services/lab03/README.md) for
Lab03's current, tracked documentation.

## Postman

Manual and Newman-automated request collections. See
[`../postman/README.md`](../postman/README.md) for the base Film Manager
collection, and each lab's own guide for lab-specific collections:
[`../postman/lab02/README.md`](../postman/lab02/README.md),
[`../postman/lab03/README.md`](../postman/lab03/README.md),
[`../postman/lab04/README.md`](../postman/lab04/README.md),
[`../postman/lab05/README.md`](../postman/lab05/README.md).
