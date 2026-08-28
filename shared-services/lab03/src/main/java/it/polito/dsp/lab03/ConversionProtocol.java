package it.polito.dsp.lab03;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

final class ConversionProtocol {
    static final int DEFAULT_PORT = 2001;
    // Overridable only via -Dlab03.socketTimeoutMs=<ms> so connect/read-timeout
    // scenarios can be tested deterministically and quickly; the wire protocol
    // itself carries no timeout value, so this is a local operational knob, not
    // a protocol change. Defaults to 30s in production.
    static final int SOCKET_TIMEOUT_MS = Integer.getInteger("lab03.socketTimeoutMs", 30000);
    static final int MAX_IMAGE_BYTES = 50 * 1024 * 1024;

    /**
     * Test-only seam: when set (via -Dlab03.forceInternalError=true), the next
     * conversion deterministically fails as an unexpected internal error (status
     * '2'), so status-2 framing can be exercised without a real ImageIO/runtime
     * failure. Not reachable through any client-controlled protocol input.
     */
    private static final boolean FORCE_INTERNAL_ERROR = Boolean.getBoolean("lab03.forceInternalError");

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
            throw new WrongRequestException("Connection closed before receiving the expected bytes.", error);
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
        String normalizedSource = normalizeType(sourceType);
        String normalizedTarget = normalizeType(targetType);
        if (!isSupportedType(normalizedSource) || !isSupportedType(normalizedTarget)) {
            throw new WrongRequestException("Supported media types are PNG, JPG, and GIF.");
        }
        if (sourceBytes.length == 0) {
            throw new WrongRequestException("Wrong request: empty image payload.");
        }

        BufferedImage image = decodeAndValidateType(sourceBytes, normalizedSource);
        BufferedImage encodable = prepareForTarget(image, normalizedTarget);

        ByteArrayOutputStream converted = new ByteArrayOutputStream();
        if (FORCE_INTERNAL_ERROR) {
            throw new IOException("Forced internal failure (test seam).");
        }
        boolean written = ImageIO.write(encodable, imageIoFormat(normalizedTarget), converted);
        if (!written) {
            // written==false only means no registered writer could encode THIS
            // image's color model for this format; it does not mean no writer
            // for the format exists at all (see prepareForTarget for the JPG/
            // alpha case this guards against). Do not claim "no writer available".
            throw new IOException("Image conversion to " + normalizedTarget + " failed.");
        }
        return converted.toByteArray();
    }

    /**
     * Baseline JPEG cannot encode every BufferedImage color model ImageIO may
     * decode from a PNG/GIF: not just alpha (ARGB), but also things like
     * 16-bit-per-channel rasters, indexed/palette models, gray models, etc.
     * ImageIO.write(...) simply returns false for any of these with no
     * compatible JPEG writer, which is otherwise easy to misdiagnose as "no
     * writer available". Rather than special-casing hasAlpha() (which misses
     * this whole class of JPEG-incompatible models), every JPG target is
     * unconditionally normalized to an 8-bit opaque TYPE_INT_RGB image first,
     * composited onto white so any transparency is resolved deterministically
     * — exactly like exporting to JPEG in any ordinary image editor. This is
     * a no-op in terms of correctness for an already-plain-RGB source (a
     * redundant copy, acceptable given the lab's bounded image sizes) and a
     * real, necessary fix for anything else. PNG and GIF targets are returned
     * untouched — both support the source's original color model, so nothing
     * needs to be forced through RGB for them.
     */
    private static BufferedImage prepareForTarget(BufferedImage image, String normalizedTarget) {
        if (!"JPG".equals(normalizedTarget)) {
            return image;
        }
        BufferedImage opaque = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = opaque.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
            graphics.drawImage(image, 0, 0, null);
        } finally {
            graphics.dispose();
        }
        return opaque;
    }

    /**
     * Decodes the image and checks its content-detected format against the
     * client-declared source type. Never trusts a file name/extension: the
     * declared type must match what ImageIO actually sniffs from the bytes.
     */
    private static BufferedImage decodeAndValidateType(byte[] sourceBytes, String normalizedSource) throws IOException {
        BufferedImage image;
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(sourceBytes))) {
            if (iis == null) {
                throw new WrongRequestException("Wrong request: input file is not a readable image.");
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                throw new WrongRequestException("Wrong request: input file is not a readable image.");
            }
            ImageReader reader = readers.next();
            try {
                String detectedType = normalizeType(reader.getFormatName());
                if (!normalizedSource.equals(detectedType)) {
                    throw new WrongRequestException("Wrong request: declared source type " + normalizedSource
                            + " does not match actual image content (" + detectedType + ").");
                }
                reader.setInput(iis);
                image = reader.read(0);
            } catch (IOException decodeError) {
                if (decodeError instanceof WrongRequestException) {
                    throw decodeError;
                }
                throw new WrongRequestException("Wrong request: input file is not a readable image.", decodeError);
            } finally {
                reader.dispose();
            }
        }
        if (image == null) {
            throw new WrongRequestException("Wrong request: input file is not a readable image.");
        }
        return image;
    }
}
