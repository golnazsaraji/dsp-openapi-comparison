# Lab04 Specifications

This folder contains the Lab04 course material and WebSocket message specifications.

## Contents

| Path | Meaning |
|---|---|
| `material/` | Lab04 PDF material provided for the course. |
| `schemas/ws_message_schema.json` | JSON Schema for WebSocket status messages. |
| `examples/` | Valid login, update, and logout WebSocket message examples. |

The final REST API operations that expose the online-user snapshot and active-film selection are specified in:

```text
../../openapi/openapi.yaml
```

The current, wired-in realtime implementation lives under
`../../shared-services/src/realtime/` (server) and
`../../shared-services/lab04/client-app/src/realtime/` (client) — see
`../../shared-services/lab04/README.md` for the full file map, and
`../../docs/lab04-implementation.md` for how it works.
