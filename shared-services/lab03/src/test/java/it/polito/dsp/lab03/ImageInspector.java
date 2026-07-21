package it.polito.dsp.lab03;

import java.awt.image.BufferedImage;
import java.io.File;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/**
 * Test-only content-aware decoder (src/test/java, never shipped): reports the
 * actual ImageIO-detected format, real decoded dimensions, a sampled
 * distinct-color count, whether the decoded color model has an alpha
 * channel, and (optionally) the exact pixel at a given coordinate — so tests
 * can verify converted output by content instead of by extension or magic
 * bytes alone.
 */
public final class ImageInspector {
    private static final int MAX_SAMPLES = 5000;

    public static void main(String[] args) throws Exception {
        if (args.length != 1 && args.length != 3) {
            System.err.println("Usage: ImageInspector <path> [sampleX sampleY]");
            System.exit(1);
        }
        File file = new File(args[0]);
        try (ImageInputStream iis = ImageIO.createImageInputStream(file)) {
            if (iis == null) {
                System.out.println("format=UNKNOWN");
                return;
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                System.out.println("format=UNKNOWN");
                return;
            }
            ImageReader reader = readers.next();
            String detectedFormat = reader.getFormatName();
            reader.setInput(iis);
            BufferedImage image = reader.read(0);
            reader.dispose();
            if (image == null) {
                System.out.println("format=" + detectedFormat + " decodeFailed=true");
                return;
            }
            int width = image.getWidth();
            int height = image.getHeight();
            int distinctColors = sampleDistinctColors(image, width, height);
            StringBuilder line = new StringBuilder()
                    .append("format=").append(detectedFormat)
                    .append(" width=").append(width)
                    .append(" height=").append(height)
                    .append(" distinctColors=").append(distinctColors)
                    .append(" hasAlpha=").append(image.getColorModel().hasAlpha())
                    .append(" bytes=").append(file.length());
            if (args.length == 3) {
                int sampleX = Integer.parseInt(args[1]);
                int sampleY = Integer.parseInt(args[2]);
                int pixel = image.getRGB(sampleX, sampleY);
                line.append(" pixelR=").append((pixel >> 16) & 0xFF)
                        .append(" pixelG=").append((pixel >> 8) & 0xFF)
                        .append(" pixelB=").append(pixel & 0xFF);
            }
            System.out.println(line);
        }
    }

    private static int sampleDistinctColors(BufferedImage image, int width, int height) {
        long totalPixels = (long) width * (long) height;
        int step = (int) Math.max(1, totalPixels / MAX_SAMPLES);
        Set<Integer> distinct = new HashSet<>();
        long index = 0;
        for (int y = 0; y < height && distinct.size() < MAX_SAMPLES; y++) {
            for (int x = 0; x < width && distinct.size() < MAX_SAMPLES; x++) {
                if (index % step == 0) {
                    distinct.add(image.getRGB(x, y) & 0xFFFFFF);
                }
                index++;
            }
        }
        return distinct.size();
    }
}
