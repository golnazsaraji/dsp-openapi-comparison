# Specifications

This directory is the evaluation-facing entry point for the five laboratory specifications.

Each lab has its own folder with the provided course material in `material/` and the project specification artifacts used by the implementation.

| Lab | Folder | Contents |
|---|---|---|
| Lab01 | `lab01/` | Course PDFs, Draft 7 JSON Schemas, and valid JSON examples. |
| Lab02 | `lab02/` | Course PDFs and gRPC converter `.proto`; REST image endpoints are in `../openapi/openapi.yaml`. |
| Lab03 | `lab03/` | Course PDFs and TCP converter protocol/source artifacts. |
| Lab04 | `lab04/` | Course PDFs, WebSocket message schema, and valid message examples. |
| Lab05 | `lab05/` | Course PDFs, MQTT message schema, valid examples, and Mosquitto configuration. |

The canonical REST API specification for the final Film Manager server is:

```text
../openapi/openapi.yaml
```

The initial simple OpenAPI example used before the final Film Manager contract is:

```text
../openapi/initial-example.yaml
```
