package it.polito.dsp.lab03;

import java.io.IOException;

/**
 * Marks a client-caused protocol violation (unsupported type, invalid length,
 * truncated framing, malformed/empty image, declared-vs-actual type mismatch).
 * The server reports these as status '1'; anything else falls through as status '2'.
 */
final class WrongRequestException extends IOException {
    WrongRequestException(String message) {
        super(message);
    }

    WrongRequestException(String message, Throwable cause) {
        super(message, cause);
    }
}
