package it.polito.dsp.lab03;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class ConversionRequestClient {
    private static final String DEFAULT_HOST = "127.0.0.1";

    public static void main(String[] args) throws IOException {
        if (args.length < 3 || args.length > 5) {
            System.err.println("Usage: java it.polito.dsp.lab03.ConversionRequestClient <original_type> <target_type> <image_path> [host] [port]");
            System.exit(1);
        }

        String sourceType = ConversionProtocol.normalizeType(args[0]);
        String targetType = ConversionProtocol.normalizeType(args[1]);
        Path sourcePath = resolveImagePath(args[2]);
        String host = args.length >= 4 ? args[3] : DEFAULT_HOST;
        int port = args.length == 5 ? Integer.parseInt(args[4]) : ConversionProtocol.DEFAULT_PORT;

        if (!ConversionProtocol.isSupportedType(sourceType) || !ConversionProtocol.isSupportedType(targetType)) {
            throw new IllegalArgumentException("Supported media types are PNG, JPG, and GIF.");
        }
        if (!Files.isRegularFile(sourcePath)) {
            throw new IOException("Input file does not exist: " + sourcePath);
        }

        byte[] sourceBytes = Files.readAllBytes(sourcePath);
        if (sourceBytes.length > ConversionProtocol.MAX_IMAGE_BYTES) {
            throw new IOException("Input file is too large for this client.");
        }

        byte[] responseBytes = requestConversion(host, port, sourceType, targetType, sourceBytes);
        Path outputPath = outputPath(sourcePath, targetType);
        Files.write(outputPath, responseBytes);
        System.out.println("Converted image saved to " + outputPath);
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
            int status = input.readByte();
            int length = input.readInt();
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
