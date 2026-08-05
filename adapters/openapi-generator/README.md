# OpenAPI Generator Adapter

This directory contains the regeneration-safe adapter layer used by the final
custom OpenAPI Generator server (`generated-openapi-generator-custom/`). Every
file here is handwritten and lives outside the generated project directory,
so `npm run generate:final` never overwrites it.

## Contents

| File | Role |
|---|---|
| `DefaultServiceAdapter.js` | Maps generated OpenAPI service calls to `shared-services/src/services/FilmManagerService.js`. The customized generated service layer calls these adapter functions with arguments derived from the OpenAPI operation parameters. |
| `sessionAuth.js` | Configures `express-session` (cookie name `connect.sid`, the express-session default) and Passport's local strategy for login/session authentication; used by the generated server's auth middleware. |
| `realtimeGateway.js` | Lab04 binding: attaches the WebSocket presence gateway (`shared-services/src/realtime/attachRealtimeGateway.js`) to the real `FilmManagerService` singleton and the HTTP server, at a configurable path (`WS_PATH`, default `/ws`). |
| `mqttGateway.js` | Lab05 binding: attaches the MQTT gateway (`shared-services/src/mqtt/attachMqttGateway.js`) to the real `FilmManagerService` singleton, publishing active-film status to the configured broker (`MQTT_URL`). |

`out/expressServer.mustache` (the generation template) wires `realtimeGateway.js`
and `mqttGateway.js` in automatically whenever the server starts — see
`docs/lab04-implementation.md` and `docs/lab05-implementation.md` for the full
behavior, and `docs/configuration.md` for every environment variable involved.
