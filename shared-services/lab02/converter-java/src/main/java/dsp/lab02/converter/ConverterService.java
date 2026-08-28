package dsp.lab02.converter;

import com.google.protobuf.ByteString;
import dsp.lab02.converter.proto.*;
import io.grpc.stub.StreamObserver;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Set;

final class ConverterService extends ConverterGrpc.ConverterImplBase {
    private static final Set<String> TYPES = Set.of("image/png", "image/jpeg", "image/gif");
    private static final int MAX_INPUT = Integer.parseInt(System.getenv().getOrDefault("CONVERTER_MAX_INPUT_BYTES", "5242880"));
    private static final int CHUNK = Integer.parseInt(System.getenv().getOrDefault("CONVERTER_OUTPUT_CHUNK_SIZE", "65536"));

    @Override
    public StreamObserver<ConvertRequest> convert(StreamObserver<ConvertResponse> responses) {
        return new StreamObserver<>() {
            ConversionMetadata metadata;
            final ByteArrayOutputStream input = new ByteArrayOutputStream();
            boolean terminated;

            private void fail(String code, String message) {
                if (terminated) return;
                terminated = true;
                responses.onNext(ConvertResponse.newBuilder().setFailure(ConversionFailure.newBuilder()
                        .setRequestId(metadata == null ? "" : metadata.getRequestId()).setCode(code).setMessage(message)).build());
                responses.onCompleted();
            }

            @Override public void onNext(ConvertRequest message) {
                if (terminated) return;
                if (message.hasMetadata()) {
                    if (metadata != null || input.size() > 0) { fail("PROTOCOL", "Conversion metadata must appear exactly once before chunks."); return; }
                    metadata = message.getMetadata();
                    if (!TYPES.contains(metadata.getSourceMediaType()) || !TYPES.contains(metadata.getTargetMediaType())
                            || metadata.getSourceMediaType().equals(metadata.getTargetMediaType())) {
                        fail("UNSUPPORTED_MEDIA", "Source and target must be different supported canonical media types.");
                    }
                    return;
                }
                if (!message.hasChunk() || metadata == null) { fail("PROTOCOL", "Metadata is required before source chunks."); return; }
                if (input.size() + message.getChunk().size() > MAX_INPUT) { fail("INPUT_TOO_LARGE", "Source image exceeds the configured limit."); return; }
                try { message.getChunk().writeTo(input); } catch (IOException error) { fail("INPUT", "Unable to receive source image."); }
            }

            @Override public void onError(Throwable error) { terminated = true; }

            @Override public void onCompleted() {
                if (terminated) return;
                if (metadata == null || input.size() == 0) { fail("PROTOCOL", "Metadata and source bytes are required."); return; }
                try {
                    BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(input.toByteArray()));
                    if (decoded == null) { fail("DECODE", "Source bytes cannot be decoded."); return; }
                    String detected = detect(input.toByteArray());
                    if (!metadata.getSourceMediaType().equals(detected)) { fail("SOURCE_MISMATCH", "Declared source media type does not match source bytes."); return; }
                    BufferedImage outputImage = prepareForTarget(decoded, metadata.getTargetMediaType());
                    String format = switch (metadata.getTargetMediaType()) {
                        case "image/png" -> "png"; case "image/jpeg" -> "jpeg"; case "image/gif" -> "gif";
                        default -> throw new IllegalStateException();
                    };
                    ByteArrayOutputStream converted = new ByteArrayOutputStream();
                    if (!ImageIO.write(outputImage, format, converted) || converted.size() == 0) {
                        fail("ENCODE", "Target image encoder is unavailable."); return;
                    }
                    byte[] bytes = converted.toByteArray();
                    for (int offset = 0; offset < bytes.length; offset += CHUNK) {
                        responses.onNext(ConvertResponse.newBuilder().setChunk(ByteString.copyFrom(
                                bytes, offset, Math.min(CHUNK, bytes.length - offset))).build());
                    }
                    responses.onNext(ConvertResponse.newBuilder().setResult(ConversionResult.newBuilder()
                            .setRequestId(metadata.getRequestId()).setMediaType(metadata.getTargetMediaType())
                            .setByteLength(bytes.length)).build());
                    terminated = true; responses.onCompleted();
                } catch (Exception error) { fail("CONVERSION", "Image conversion failed."); }
            }
        };
    }

    private static String detect(byte[] bytes) {
        if (bytes.length >= 8 && (bytes[0] & 0xff) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') return "image/png";
        if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff) return "image/jpeg";
        if (bytes.length >= 6 && bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F') return "image/gif";
        return "";
    }

    static BufferedImage prepareForTarget(BufferedImage decoded, String targetMediaType) {
        if (!"image/jpeg".equals(targetMediaType) || !decoded.getColorModel().hasAlpha()) return decoded;
        BufferedImage flattened = new BufferedImage(decoded.getWidth(), decoded.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = flattened.createGraphics();
        graphics.setColor(Color.WHITE);
        graphics.fillRect(0, 0, decoded.getWidth(), decoded.getHeight());
        graphics.drawImage(decoded, 0, 0, null);
        graphics.dispose();
        return flattened;
    }
}
