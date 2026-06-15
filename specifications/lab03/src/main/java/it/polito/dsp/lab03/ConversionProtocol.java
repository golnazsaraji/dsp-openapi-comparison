package it.polito.dsp.lab03;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;

final class ConversionProtocol {
    static final int DEFAULT_PORT = 2001;
    static final int SOCKET_TIMEOUT_MS = 30000;
    static final int MAX_IMAGE_BYTES = 50 * 1024 * 1024;

    private ConversionProtocol() {
    }

    static String normalizeType(String type) {
        String normalized = type == null ? "" : type.trim().toUpperCase();
        if ("JPEG".equals(normalized)) return "JPG";
        return normalized;
    }

    static boolean isSupportedType(String type) {
        String normalized = normalizeType(type);
        return "PNG".equals(normalized) || "JPG".equals(normalized) || "GIF".equals(normalized);
    }

    static String imageIoFormat(String type) {
        String normalized = normalizeType(type);
        return "JPG".equals(normalized) ? "jpeg" : normalized.toLowerCase();
    }

    static byte[] readExactly(DataInputStream input, int length) throws IOException {
        byte[] data = new byte[length];
        try {
            input.readFully(data);
        } catch (EOFException error) {
            throw new IOException("Connection closed before receiving the expected bytes.", error);
        }
        return data;
    }

    static String readAscii(DataInputStream input, int length) throws IOException {
        return new String(readExactly(input, length), StandardCharsets.US_ASCII);
    }

    static void writeAscii(DataOutputStream output, String value) throws IOException {
        output.write(value.getBytes(StandardCharsets.US_ASCII));
    }

    static byte[] convert(byte[] sourceBytes, String sourceType, String targetType) throws IOException {
        if (!isSupportedType(sourceType) || !isSupportedType(targetType)) {
            throw new IllegalArgumentException("Supported media types are PNG, JPG, and GIF.");
        }

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(sourceBytes));
        if (image == null) {
            throw new IOException("Input file is not a readable image.");
        }

        ByteArrayOutputStream converted = new ByteArrayOutputStream();
        boolean written = ImageIO.write(image, imageIoFormat(targetType), converted);
        if (!written) {
            throw new IOException("No ImageIO writer available for " + targetType + ".");
        }
        return converted.toByteArray();
    }
}
