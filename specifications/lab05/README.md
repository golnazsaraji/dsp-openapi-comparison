# Lab05 Specifications

This folder contains the Lab05 course material and MQTT film-selection specifications.

## Contents

| Path | Meaning |
|---|---|
| `material/` | Lab05 PDF material provided for the course. |
| `schemas/mqtt_film_message_schema.json` | JSON Schema for retained MQTT film-selection messages. |
| `examples/` | Valid active, inactive, and deleted MQTT message examples. |
| `broker/mosquitto.conf` | Mosquitto configuration with MQTT over WebSockets support. |

The final REST API operation that rejects conflicting active-film selections is specified in:

```text
../../openapi/openapi.yaml
```

The shared service keeps runtime MQTT helper code under `../../shared-services/lab05/`.
