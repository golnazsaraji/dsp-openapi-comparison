package it.polito.dsp.lab03;

/**
 * Marks an expected client-side failure (bad CLI usage, invalid input file,
 * bad port) that should be reported as a concise message, not a stack trace.
 */
final class ClientOperationException extends Exception {
    ClientOperationException(String message) {
        super(message);
    }
}
