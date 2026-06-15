# Lab04 WebSocket Artifacts

This directory contains the Lab04 WebSocket design artifacts for the final project.

## Lab04 Scope

Lab04 extends the Film Manager service with:

| Requirement | Project location |
|---|---|
| Select one active public review film for the authenticated user. | `../../openapi/openapi.yaml`, `../src/services/FilmManagerService.js` |
| Provide a snapshot of currently logged-in users and their active films. | `../../openapi/openapi.yaml`, `../src/services/FilmManagerService.js` |
| Define WebSocket status messages for login, active-film updates, and logout. | `schemas/ws_message_schema.json` |
| Keep valid examples of login, update, and logout messages. | `examples/` |
| Maintain the React `onlineList` state from received WebSocket messages. | `client/onlineListReducer.js` |
| Open a browser WebSocket and apply incoming messages to `onlineList`. | `client/connectOnlineWebSocket.js` |
| Keep a server-side broadcast helper for connected WebSocket clients. | `server/WebSocketStatusHub.js` |
| Create a `ws` server mounted at `/ws/status`. | `server/createStatusWebSocketServer.js` |

## Message Behavior

When a WebSocket connection is established, the server sends one status message for each currently logged-in user.

After that:

- login sends `typeMessage: "login"` with user information and the active film if present
- active-film selection sends `typeMessage: "update"` with the user and selected film
- logout sends `typeMessage: "logout"` with the user id

The message shape is documented by `schemas/ws_message_schema.json`.

## Runtime Boundary

The final project keeps the WebSocket message contract and reusable client/server helpers here. The generated REST server does not currently start the `ws` server automatically; it can be wired by creating the server with `createStatusWebSocketServer(httpServer, () => FilmManagerService.webSocketSnapshot())` and broadcasting the messages returned by `FilmManagerService.webSocketStatusMessage(...)` after login, active-film selection, and logout.
