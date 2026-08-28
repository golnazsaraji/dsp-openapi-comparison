package it.polito.dsp.lab03;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

public class ConversionRequestClient {
    private static final String DEFAULT_HOST = "127.0.0.1";
    private static final String USAGE = "Usage: java it.polito.dsp.lab03.ConversionRequestClient "
            + "<original_type> <target_type> <image_path> [host] [port]";

    public static void main(String[] args) {
        System.exit(run(args));
    }

    /**
     * Runs the client and returns a process exit code instead of letting
     * exceptions reach the JVM's default handler: expected failures (bad
     * usage, bad input file, network/protocol errors) print one concise
     * message and never a stack trace. Only a genuine internal bug reaches
     * the last-resort branch below.
     */
    static int run(String[] args) {
        try {
            execute(args);
            return 0;
        } catch (ClientOperationException | IOException expected) {
            System.err.println(expected.getMessage());
            return 1;
        } catch (RuntimeException unexpected) {
            System.err.println("Unexpected internal client failure: " + unexpected);
            unexpected.printStackTrace();
            return 1;
        }
    }

    private static void execute(String[] args) throws ClientOperationException, IOException {
        if (args.length < 3 || args.length > 5) {
            throw new ClientOperationException(USAGE);
        }

        String sourceType = ConversionProtocol.normalizeType(args[0]);
        String targetType = ConversionProtocol.normalizeType(args[1]);
        if (!ConversionProtocol.isSupportedType(sourceType) || !ConversionProtocol.isSupportedType(targetType)) {
            throw new ClientOperationException("Unsupported media type. Supported media types are PNG, JPG, and GIF.");
        }

        Path sourcePath = resolveImagePath(args[2]);
        validateInputFile(sourcePath);

        String host = args.length >= 4 ? args[3] : DEFAULT_HOST;
        int port = args.length == 5 ? parsePort(args[4]) : ConversionProtocol.DEFAULT_PORT;

        byte[] sourceBytes = Files.readAllBytes(sourcePath);
        Path outputPath = outputPath(sourcePath, targetType);
        Path tempOutputPath = outputPath.resolveSibling(outputPath.getFileName().toString() + ".tmp");
        try {
            byte[] responseBytes = requestConversion(host, port, sourceType, targetType, sourceBytes);
            // Write to a same-directory temporary file first, then replace the
            // final name only once the full response is known-good, so a
            // truncated/failed transfer never leaves a partial final output.
            Files.write(tempOutputPath, responseBytes);
            Files.move(tempOutputPath, outputPath, StandardCopyOption.REPLACE_EXISTING);
            System.out.println("Converted image saved to " + outputPath);
        } finally {
            Files.deleteIfExists(tempOutputPath);
        }
    }

    private static int parsePort(String text) throws ClientOperationException {
        int port;
        try {
            port = Integer.parseInt(text);
        } catch (NumberFormatException error) {
            throw new ClientOperationException("Invalid port: '" + text + "' is not a number.");
        }
        if (port < 1 || port > 65535) {
            throw new ClientOperationException("Invalid port: " + port + " is outside the valid range 1-65535.");
        }
        return port;
    }

    private static void validateInputFile(Path path) throws ClientOperationException {
        if (!Files.exists(path)) {
            throw new ClientOperationException("Input file does not exist: " + path);
        }
        if (Files.isDirectory(path)) {
            throw new ClientOperationException("Input path is a directory, not a file: " + path);
        }
        if (!Files.isRegularFile(path)) {
            throw new ClientOperationException("Input path is not a regular file: " + path);
        }
        if (!Files.isReadable(path)) {
            throw new ClientOperationException("Input file is not readable: " + path);
        }
        long size;
        try {
            size = Files.size(path);
        } catch (IOException error) {
            throw new ClientOperationException("Unable to determine the size of input file: " + path);
        }
        if (size > ConversionProtocol.MAX_IMAGE_BYTES) {
            throw new ClientOperationException("Input file is too large for this client (" + size
                    + " bytes, limit " + ConversionProtocol.MAX_IMAGE_BYTES + " bytes): " + path);
        }
    }

    private static byte[] requestConversion(String host, int port, String sourceType, String targetType, byte[] sourceBytes) throws IOException {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), ConversionProtocol.SOCKET_TIMEOUT_MS);
            socket.setSoTimeout(ConversionProtocol.SOCKET_TIMEOUT_MS);

            DataOutputStream output = new DataOutputStream(socket.getOutputStream());
            ConversionProtocol.writeAscii(output, sourceType);
            ConversionProtocol.writeAscii(output, targetType);
            output.writeInt(sourceBytes.length);
            output.write(sourceBytes);
            output.flush();

            DataInputStream input = new DataInputStream(socket.getInputStream());
            int status = readStatusByte(input);
            if (status != '0' && status != '1' && status != '2') {
                throw new IOException("Malformed server response: unexpected status byte " + status + ".");
            }
            int length = readResponseLength(input);
            if (length < 0 || length > ConversionProtocol.MAX_IMAGE_BYTES) {
                throw new IOException("Invalid response length.");
            }

            byte[] payload = ConversionProtocol.readExactly(input, length);
            if (status == '0') {
                return payload;
            }

            String message = new String(payload, StandardCharsets.US_ASCII);
            throw new IOException("Converter returned error " + (char) status + ": " + message);
        }
    }

    private static int readStatusByte(DataInputStream input) throws IOException {
        try {
            return input.readByte();
        } catch (EOFException error) {
            throw new IOException("Server closed the connection before sending a response status.", error);
        }
    }

    private static int readResponseLength(DataInputStream input) throws IOException {
        try {
            return input.readInt();
        } catch (EOFException error) {
            throw new IOException("Server closed the connection before sending the response length.", error);
        }
    }

    private static Path resolveImagePath(String rawPath) {
        Path directPath = Paths.get(rawPath);
        if (Files.isRegularFile(directPath)) {
            return directPath;
        }
        return Paths.get("image").resolve(rawPath);
    }

    private static Path outputPath(Path sourcePath, String targetType) {
        String fileName = sourcePath.getFileName().toString();
        int dot = fileName.lastIndexOf('.');
        String baseName = dot >= 0 ? fileName.substring(0, dot) : fileName;
        String extension = ConversionProtocol.normalizeType(targetType).toLowerCase();
        return sourcePath.resolveSibling(baseName + "_converted." + extension);
    }
}
