# Lab03 Specifications

This folder contains the Lab03 course material and TCP converter protocol artifacts.

## Contents

| Path | Meaning |
|---|---|
| `material/` | Lab03 PDF material provided for the course. |
| `src/main/java/it/polito/dsp/lab03/ConversionProtocol.java` | Protocol constants and binary message helpers. |
| `src/main/java/it/polito/dsp/lab03/ConverterServer.java` | Concurrent TCP converter server. |
| `src/main/java/it/polito/dsp/lab03/ConversionRequestClient.java` | Command-line TCP client. |

Protocol summary:

| Field | Size | Meaning |
|---|---:|---|
| Original media type | 3 bytes | ASCII `PNG`, `JPG`, or `GIF`. |
| Target media type | 3 bytes | ASCII `PNG`, `JPG`, or `GIF`. |
| Image length | 4 bytes | Signed integer in network byte order. |
| Image bytes | variable | File content to convert. |

The shared service keeps a working copy of these artifacts under `../../shared-services/lab03/`.
