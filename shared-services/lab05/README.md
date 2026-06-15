# Lab05 MQTT Artifacts

This directory contains the Lab05 MQTT design artifacts for the final project.

## Lab05 Scope

Lab05 extends Lab04 active-film selection with MQTT-based synchronization:

| Requirement | Project location |
|---|---|
| Reject active-film selection when another user already selected the film. | `../src/services/FilmManagerService.js` |
| Define MQTT film status messages. | `schemas/mqtt_film_message_schema.json` |
| Keep valid examples for active, inactive, and deleted film states. | `examples/` |
| Provide Mosquitto MQTT over WebSockets configuration. | `broker/mosquitto.conf` |
| Publish retained film status messages from the Film Manager side. | `server/MqttFilmPublisher.js` |
| Connect a React/browser client to MQTT over WebSockets and call `displayFilmSelection(topic, parsedMessage)`. | `client/connectFilmSelectionMqtt.js` |

## Topics

Each public film uses its id as the MQTT topic. For example, film `2` uses topic:

```text
2
```

## Message Rules

- `active`: includes `userId` and `userName`
- `inactive`: no user fields
- `deleted`: no user fields

All Film Manager publications should use `retain: true`, so clients receive the latest status immediately after subscribing.

## Broker

The included Mosquitto configuration enables both plain MQTT and MQTT over WebSockets:

```bash
mosquitto -v -c shared-services/lab05/broker/mosquitto.conf
```

The React/browser side should connect to:

```text
ws://127.0.0.1:8080
```

## Runtime Boundary

The final project includes the schema, examples, broker configuration, and reusable MQTT client/server helpers. The generated REST server does not currently start an MQTT client automatically; it can be wired by creating `createMqttFilmPublisher(...)` and publishing the retained messages returned by `FilmManagerService.mqttInitialFilmMessages()` and `FilmManagerService.mqttFilmMessage(...)`.
