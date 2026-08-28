package dsp.lab02.converter;

import org.junit.jupiter.api.Test;
import java.awt.image.BufferedImage;
import static org.junit.jupiter.api.Assertions.*;

class ConverterServiceTest {
    @Test
    void transparentPixelsAreFlattenedOntoWhiteForJpeg() {
        BufferedImage transparent = new BufferedImage(2, 2, BufferedImage.TYPE_INT_ARGB);
        BufferedImage flattened = ConverterService.prepareForTarget(transparent, "image/jpeg");
        assertFalse(flattened.getColorModel().hasAlpha());
        assertEquals(0x00ffffff, flattened.getRGB(0, 0) & 0x00ffffff);
    }
}
