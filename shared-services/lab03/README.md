# Lab03 TCP Converter

This directory contains the Lab03 TCP/IP socket implementation artifacts for the final project.

## Protocol

The converter server listens on TCP port `2001` by default. The client sends:

| Field | Size | Meaning |
|---|---:|---|
| Original media type | 3 bytes | ASCII `PNG`, `JPG`, or `GIF` |
| Target media type | 3 bytes | ASCII `PNG`, `JPG`, or `GIF` |
| Image length | 4 bytes | Signed integer in network byte order |
| Image bytes | variable | File content to convert |

On success, the server replies with:

| Field | Size | Meaning |
|---|---:|---|
| Status | 1 byte | ASCII `0` |
| Converted length | 4 bytes | Signed integer in network byte order |
| Converted bytes | variable | Converted image file |

On failure, the server replies with status `1` for a wrong request or `2` for an internal server error, followed by a 4-byte error-message length and an ASCII error message.

## Source Files

| File | Meaning |
|---|---|
| `src/main/java/it/polito/dsp/lab03/ConversionProtocol.java` | Shared constants and protocol helpers. |
| `src/main/java/it/polito/dsp/lab03/ConverterServer.java` | Concurrent TCP converter server. |
| `src/main/java/it/polito/dsp/lab03/ConversionRequestClient.java` | Command-line TCP client. |

The server uses `ExecutorService` so multiple clients can be handled concurrently. Both client and server set socket read timeouts to avoid deadlocks.

## Compile

From this directory:

```bash
javac -d bin src/main/java/it/polito/dsp/lab03/*.java
```

## Run

Start the server:

```bash
java -cp bin it.polito.dsp.lab03.ConverterServer
```

Run the client:

```bash
java -cp bin it.polito.dsp.lab03.ConversionRequestClient PNG JPG image.png
```

The client first checks the provided path directly. If it is not found, it also checks `image/<image_path>`, matching the laboratory note about the local `image` folder.
