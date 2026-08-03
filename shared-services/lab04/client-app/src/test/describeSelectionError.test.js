import { describe, it, expect } from 'vitest';
import { describeSelectionError, canStartSelection } from '../mqtt/describeSelectionError';

describe('describeSelectionError', () => {
    it('returns a conflict-specific message for a 409 error', () => {
        const error = Object.assign(new Error('Conflict'), { status: 409 });
        expect(describeSelectionError(error)).toMatch(/already active for another reviewer/);
    });

    it('returns the error message for a non-conflict error', () => {
        const error = Object.assign(new Error('Public film not found.'), { status: 404 });
        expect(describeSelectionError(error)).toBe('Public film not found.');
    });

    it.each([401, 403, 404, 500])('never uses the conflict-specific message for a %i error', (status) => {
        const error = Object.assign(new Error(`status ${status}`), { status });
        expect(describeSelectionError(error)).not.toMatch(/already active for another reviewer/);
    });

    it('falls back to a generic message when no error message is present', () => {
        expect(describeSelectionError({})).toBe('Unable to select this film as active.');
    });
});

describe('canStartSelection', () => {
    it('allows starting a selection when nothing is pending', () => {
        expect(canStartSelection(null)).toBe(true);
    });

    it('blocks starting a new selection while one is already pending, for any film', () => {
        expect(canStartSelection(2)).toBe(false);
        expect(canStartSelection(3)).toBe(false); // pending on a DIFFERENT film must still block
    });
});
