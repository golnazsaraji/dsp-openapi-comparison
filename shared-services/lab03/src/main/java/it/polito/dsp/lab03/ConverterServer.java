package it.polito.dsp.lab03;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public class ConverterServer {
    private static final int DEFAULT_WORKER_THREADS = 16;
    private static final int DEFAULT_QUEUE_CAPACITY = 64;

    // Test-only synchronization aid: prints one-line markers for connection
    // accept/queue/reject/handle-start events so tests can wait for a precise
    // state (e.g. "the sole worker is now occupied") instead of sleeping.
    // Off by default; never touches wire-protocol bytes.
    private static final boolean DEBUG_LOGGING = Boolean.getBoolean("lab03.debugLogging");

    private final int requestedPort;
    private final ExecutorService workers;
    private volatile boolean running = true;
    private volatile ServerSocket serverSocket;

    public ConverterServer(int port) {
        this(port, resolvePositiveIntProperty("lab03.workerThreads", DEFAULT_WORKER_THREADS),
                resolvePositiveIntProperty("lab03.queueCapacity", DEFAULT_QUEUE_CAPACITY));
    }

    ConverterServer(int port, int workerThreads, int queueCapacity) {
        this.requestedPort = port;
        ThreadFactory daemonWorkerFactory = runnable -> {
            Thread thread = new Thread(runnable, "lab03-converter-worker");
            // Daemon so a stalled client blocked in a socket read can never
            // keep the JVM alive past shutdown; see stop().
            thread.setDaemon(true);
            return thread;
        };
        this.workers = new ThreadPoolExecutor(
                workerThreads, workerThreads,
                0L, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(queueCapacity),
                daemonWorkerFactory,
                new ThreadPoolExecutor.AbortPolicy());
    }

    private static int resolvePositiveIntProperty(String propertyName, int defaultValue) {
        String raw = System.getProperty(propertyName);
        if (raw == null) {
            return defaultValue;
        }
        int value;
        try {
            value = Integer.parseInt(raw.trim());
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException("Invalid " + propertyName + ": '" + raw + "' is not a number.");
        }
        if (value <= 0) {
            throw new IllegalArgumentException("Invalid " + propertyName + ": " + value + " must be positive.");
        }
        return value;
    }

    public void start() throws IOException {
        try (ServerSocket socket = new ServerSocket(requestedPort)) {
            this.serverSocket = socket;
            int boundPort = socket.getLocalPort();
            System.out.println("Converter TCP server listening on port " + boundPort);
            while (running) {
                Socket client;
                try {
                    client = socket.accept();
                } catch (IOException error) {
                    // stop() closes the server socket to unblock accept();
                    // any other accept() failure must not kill the loop.
                    if (!running) {
                        break;
                    }
                    continue;
                }
                try {
                    workers.submit(() -> handle(client));
                    debugLog("worker-queued");
                } catch (RejectedExecutionException rejected) {
                    debugLog("worker-rejected");
                    closeQuietly(client);
                }
            }
        } finally {
            workers.shutdownNow();
        }
    }

    /** Stops the accept loop and the worker pool; safe to call from a shutdown hook or a test harness. */
    public void stop() {
        running = false;
        ServerSocket socket = this.serverSocket;
        if (socket != null) {
            closeQuietly(socket);
        }
        workers.shutdownNow();
    }

    private void handle(Socket client) {
        debugLog("worker-started");
        try {
            client.setSoTimeout(ConversionProtocol.SOCKET_TIMEOUT_MS);
            DataInputStream input = new DataInputStream(client.getInputStream());
            DataOutputStream output = new DataOutputStream(client.getOutputStream());

            String sourceType = ConversionProtocol.normalizeType(ConversionProtocol.readAscii(input, 3));
            String targetType = ConversionProtocol.normalizeType(ConversionProtocol.readAscii(input, 3));
            if (!ConversionProtocol.isSupportedType(sourceType) || !ConversionProtocol.isSupportedType(targetType)) {
                throw new WrongRequestException("Wrong request: supported media types are PNG, JPG, and GIF.");
            }

            int length = input.readInt();
            if (length <= 0 || length > ConversionProtocol.MAX_IMAGE_BYTES) {
                throw new WrongRequestException("Wrong request: invalid image length.");
            }

            byte[] sourceBytes = ConversionProtocol.readExactly(input, length);
            byte[] converted = ConversionProtocol.convert(sourceBytes, sourceType, targetType);
            output.writeByte('0');
            output.writeInt(converted.length);
            output.write(converted);
            output.flush();
        } catch (WrongRequestException error) {
            safeError(client, '1', error.getMessage());
        } catch (SocketTimeoutException error) {
            safeError(client, '1', "Wrong request: timeout while reading from client.");
        } catch (Exception error) {
            safeError(client, '2', "Internal server error: " + error.getMessage());
        } finally {
            closeQuietly(client);
        }
    }

    private static void debugLog(String marker) {
        if (DEBUG_LOGGING) {
            System.out.println("[lab03] " + marker);
        }
    }

    private static void closeQuietly(Socket socket) {
        try {
            socket.close();
        } catch (IOException ignored) {
            // Nothing useful can be done while closing a failed connection.
        }
    }

    private static void closeQuietly(ServerSocket socket) {
        try {
            socket.close();
        } catch (IOException ignored) {
            // Already stopping; nothing useful can be done here.
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

    public static void main(String[] args) {
        try {
            int port = args.length > 0 ? Integer.parseInt(args[0]) : ConversionProtocol.DEFAULT_PORT;
            ConverterServer server = new ConverterServer(port);
            Runtime.getRuntime().addShutdownHook(new Thread(server::stop, "lab03-shutdown"));
            server.start();
        } catch (IllegalArgumentException configError) {
            System.err.println(configError.getMessage());
            System.exit(1);
        } catch (IOException ioError) {
            System.err.println("Server I/O failure: " + ioError.getMessage());
            System.exit(1);
        }
    }
}
