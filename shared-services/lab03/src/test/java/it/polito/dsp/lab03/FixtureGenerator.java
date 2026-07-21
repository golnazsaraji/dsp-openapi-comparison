package it.polito.dsp.lab03;

import java.awt.Transparency;
import java.awt.color.ColorSpace;
import java.awt.image.BufferedImage;
import java.awt.image.ComponentColorModel;
import java.awt.image.DataBuffer;
import java.awt.image.WritableRaster;
import java.io.File;
import java.util.Random;
import javax.imageio.ImageIO;

/**
 * Test-only fixture generator: not part of the production Lab03 build
 * (lives under src/test/java, never compiled into the shipped classes).
 * Produces deterministic, high-entropy PNG/JPEG/GIF images on demand so the
 * test suite never needs to commit binary fixtures.
 *
 * Formats "png-alpha" and "gif-alpha" produce a three-band ARGB image
 * (fully transparent / semi-transparent red / fully opaque green, top to
 * bottom) instead of opaque noise, to reproduce the real-world case where a
 * decoded image carries an alpha channel (see ConversionProtocol.prepareForTarget).
 * Format "png-opaque-alpha" reproduces the original reported defect exactly:
 * an image with alpha=255 everywhere (no visible transparency at all) that is
 * still decoded by ImageIO as an alpha-bearing color model.
 * Format "png-16bit" produces a genuine 16-bit-per-channel RGB PNG (opaque, no
 * alpha at all) — reproduces the follow-up defect: a JPEG-incompatible color
 * model that is not caught by an alpha-only check.
 */
public final class FixtureGenerator {
    private static final long SEED = 42L;

    public static void main(String[] args) throws Exception {
        if (args.length != 4) {
            System.err.println("Usage: FixtureGenerator <png|jpg|gif|png-alpha|gif-alpha|png-opaque-alpha|png-16bit> <width> <height> <outputPath>");
            System.exit(1);
        }
        String format = args[0].toLowerCase();
        int width = Integer.parseInt(args[1]);
        int height = Integer.parseInt(args[2]);
        File outputFile = new File(args[3]);

        BufferedImage image;
        String baseFormat;
        if ("png-opaque-alpha".equals(format)) {
            baseFormat = "png";
            image = generateOpaqueAlphaNoise(width, height);
        } else if ("png-16bit".equals(format)) {
            baseFormat = "png";
            image = generate16BitRgbNoise(width, height);
        } else if (format.endsWith("-alpha")) {
            baseFormat = format.substring(0, format.length() - "-alpha".length());
            image = generateAlphaBands(width, height);
        } else {
            baseFormat = format;
            image = generateOpaqueNoise(width, height);
        }

        String ioFormat = "jpg".equals(baseFormat) ? "jpeg" : baseFormat;
        boolean written = ImageIO.write(image, ioFormat, outputFile);
        if (!written) {
            System.err.println("No ImageIO writer available for format: " + baseFormat);
            System.exit(1);
        }
        System.out.println("Generated " + outputFile.getAbsolutePath() + " (" + outputFile.length() + " bytes)");
    }

    private static BufferedImage generateOpaqueNoise(int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Random random = new Random(SEED);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                image.setRGB(x, y, random.nextInt(0xFFFFFF + 1));
            }
        }
        return image;
    }

    /**
     * High-entropy noise like generateOpaqueNoise, but stored in a
     * TYPE_INT_ARGB raster with alpha=255 everywhere: reproduces the exact
     * originally-reported defect (a fully opaque image that ImageIO still
     * decodes with an alpha-bearing color model, which the baseline JPEG
     * writer cannot encode without first being flattened).
     */
    private static BufferedImage generateOpaqueAlphaNoise(int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Random random = new Random(SEED);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = random.nextInt(0xFFFFFF + 1);
                image.setRGB(x, y, 0xFF000000 | rgb);
            }
        }
        return image;
    }

    /**
     * A genuine 16-bit-per-channel RGB raster (48 bits/pixel, opaque, no alpha
     * at all): confirmed to reproduce exactly what macOS `file` reports for
     * the originally-failing real-world fixture ("16-bit/color RGB"). ImageIO
     * decodes this back as BufferedImage.TYPE_CUSTOM with hasAlpha=false, so
     * an alpha-only JPEG-compatibility check does not catch it — only an
     * unconditional per-JPG-target normalization does.
     */
    private static BufferedImage generate16BitRgbNoise(int width, int height) {
        ComponentColorModel colorModel = new ComponentColorModel(
                ColorSpace.getInstance(ColorSpace.CS_sRGB),
                false, false, Transparency.OPAQUE, DataBuffer.TYPE_USHORT);
        WritableRaster raster = colorModel.createCompatibleWritableRaster(width, height);
        BufferedImage image = new BufferedImage(colorModel, raster, false, null);
        Random random = new Random(SEED);
        int[] pixel = new int[3];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                pixel[0] = random.nextInt(0x10000);
                pixel[1] = random.nextInt(0x10000);
                pixel[2] = random.nextInt(0x10000);
                raster.setPixel(x, y, pixel);
            }
        }
        return image;
    }

    /**
     * Three horizontal bands, top to bottom: fully transparent, 50%-alpha red,
     * fully opaque green. Band boundaries are simple thirds of the height, so
     * callers should pass a height divisible by 3 for clean, predictable bands.
     */
    private static BufferedImage generateAlphaBands(int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        int bandHeight = Math.max(1, height / 3);
        int transparentArgb = 0x00000000;
        int translucentRedArgb = (0x80 << 24) | (0xFF << 16);
        int opaqueGreenArgb = (0xFF << 24) | (0xFF << 8);
        for (int y = 0; y < height; y++) {
            int argb = y < bandHeight ? transparentArgb : (y < 2 * bandHeight ? translucentRedArgb : opaqueGreenArgb);
            for (int x = 0; x < width; x++) {
                image.setRGB(x, y, argb);
            }
        }
        return image;
    }
}
