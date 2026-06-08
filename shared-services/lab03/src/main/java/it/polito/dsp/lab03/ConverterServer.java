package it.polito.dsp.lab03;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ConverterServer {
    private final int port;
    private final ExecutorService workers;

    public ConverterServer(int port) {
        this.port = port;
        this.workers = Executors.newCachedThreadPool();
    }

    public void start() throws IOException {
        try (ServerSocket serverSocket = new ServerSocket(port)) {
            System.out.println("Converter TCP server listening on port " + port);
            while (true) {
                Socket client = serverSocket.accept();
                workers.submit(() -> handle(client));
            }
        } finally {
            workers.shutdown();
        }
    }

    private void handle(Socket client) {
        try {
            client.setSoTimeout(ConversionProtocol.SOCKET_TIMEOUT_MS);
            DataInputStream input = new DataInputStream(client.getInputStream());
            DataOutputStream output = new DataOutputStream(client.getOutputStream());

            String sourceType = ConversionProtocol.readAscii(input, 3);
            String targetType = ConversionProtocol.readAscii(input, 3);
            int length = input.readInt();

            if (!ConversionProtocol.isSupportedType(sourceType) || !ConversionProtocol.isSupportedType(targetType)) {
                writeError(output, '1', "Wrong request: supported media types are PNG, JPG, and GIF.");
                return;
            }
            if (length < 0 || length > ConversionProtocol.MAX_IMAGE_BYTES) {
                writeError(output, '1', "Wrong request: invalid image length.");
                return;
            }

            byte[] sourceBytes = ConversionProtocol.readExactly(input, length);
            byte[] converted = ConversionProtocol.convert(sourceBytes, sourceType, targetType);
            output.writeByte('0');
            output.writeInt(converted.length);
            output.write(converted);
            output.flush();
        } catch (IllegalArgumentException error) {
            safeError(client, '1', error.getMessage());
        } catch (SocketTimeoutException error) {
            safeError(client, '1', "Wrong request: timeout while reading from client.");
        } catch (Exception error) {
            safeError(client, '2', "Internal server error: " + error.getMessage());
        } finally {
            try {
                client.close();
            } catch (IOException ignored) {
                // Nothing useful can be done while closing a failed connection.
            }
        }
    }

    private static void safeError(Socket client, char code, String message) {
        if (client == null || client.isClosed()) return;
        try {
            writeError(new DataOutputStream(client.getOutputStream()), code, message);
        } catch (IOException ignored) {
            // The peer may have already closed the connection.
        }
    }

    private static void writeError(DataOutputStream output, char code, String message) throws IOException {
        byte[] messageBytes = message.getBytes(StandardCharsets.US_ASCII);
        output.writeByte(code);
        output.writeInt(messageBytes.length);
        output.write(messageBytes);
        output.flush();
    }

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : ConversionProtocol.DEFAULT_PORT;
        new ConverterServer(port).start();
    }
}
