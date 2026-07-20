package dsp.lab02.converter;

import io.grpc.Server;
import io.grpc.ServerBuilder;

public final class ConverterServer {
    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("CONVERTER_GRPC_PORT", "50051"));
        Server server = ServerBuilder.forPort(port).addService(new ConverterService()).build().start();
        Runtime.getRuntime().addShutdownHook(new Thread(server::shutdown));
        System.out.println("Lab02 Converter listening on " + port);
        server.awaitTermination();
    }
}
