import { describe, it, expect } from 'vitest';
import { applyFilmStatusMessage, removeDeletedFilms } from '../mqtt/filmSelectionReducer';

describe('applyFilmStatusMessage', () => {
    it('records an active message with userId and userName', () => {
        const next = applyFilmStatusMessage({}, '2', { status: 'active', userId: 2, userName: 'Frank' });
        expect(next).toEqual({ 2: { status: 'active', userId: 2, userName: 'Frank' } });
    });

    it('records an inactive message', () => {
        const next = applyFilmStatusMessage({ 2: { status: 'active', userId: 2, userName: 'Frank' } }, '2', { status: 'inactive' });
        expect(next).toEqual({ 2: { status: 'inactive' } });
    });

    it('marks the film entry deleted (does not just remove the key) on a deleted message', () => {
        // FilmsToReviewPage.jsx filters visible films by checking
        // `.status !== 'deleted'`; removing the key entirely instead of
        // storing a { status: 'deleted' } marker would make that check
        // silently no-op (`undefined?.status !== 'deleted'` is `true`),
        // leaving a deleted film incorrectly visible. This locks in the
        // marker-based representation the page component depends on.
        const current = { 2: { status: 'active', userId: 2, userName: 'Frank' }, 3: { status: 'inactive' } };
        const next = applyFilmStatusMessage(current, '2', { status: 'deleted' });
        expect(next).toEqual({ 2: { status: 'deleted' }, 3: { status: 'inactive' } });
    });

    it('is idempotent for a duplicate deleted message (does not create a new object reference)', () => {
        const once = applyFilmStatusMessage({}, '2', { status: 'deleted' });
        const twice = applyFilmStatusMessage(once, '2', { status: 'deleted' });
        expect(twice).toBe(once);
    });

    it('ignores extra/schema-invalid fields on inactive and deleted messages', () => {
        // The canonical schema forbids userId/userName on inactive/deleted
        // messages; even if a malformed message carried them anyway, the
        // reducer must never surface them in derived state.
        const inactiveResult = applyFilmStatusMessage({}, '2', { status: 'inactive', userId: 2, userName: 'Frank' });
        expect(inactiveResult).toEqual({ 2: { status: 'inactive' } });
        const deletedResult = applyFilmStatusMessage({}, '2', { status: 'deleted', userId: 2, userName: 'Frank' });
        expect(deletedResult).toEqual({ 2: { status: 'deleted' } });
    });

    it('ignores a malformed message (not an object)', () => {
        const current = { 2: { status: 'inactive' } };
        expect(applyFilmStatusMessage(current, '2', null)).toBe(current);
        expect(applyFilmStatusMessage(current, '2', 'not json')).toBe(current);
    });

    it('ignores a message with an unrecognized status', () => {
        const current = { 2: { status: 'inactive' } };
        expect(applyFilmStatusMessage(current, '2', { status: 'bogus' })).toBe(current);
    });

    it('ignores an active message missing userId or userName', () => {
        const current = {};
        expect(applyFilmStatusMessage(current, '2', { status: 'active', userId: 2 })).toBe(current);
        expect(applyFilmStatusMessage(current, '2', { status: 'active', userName: 'Frank' })).toBe(current);
    });

    it('ignores a topic that does not parse to a positive integer film id', () => {
        const current = { 2: { status: 'inactive' } };
        expect(applyFilmStatusMessage(current, 'not-a-film-id', { status: 'active', userId: 2, userName: 'Frank' })).toBe(current);
        expect(applyFilmStatusMessage(current, '0', { status: 'inactive' })).toBe(current);
        expect(applyFilmStatusMessage(current, '-1', { status: 'inactive' })).toBe(current);
    });

    it('is idempotent for a duplicate identical message', () => {
        const once = applyFilmStatusMessage({}, '2', { status: 'active', userId: 2, userName: 'Frank' });
        const twice = applyFilmStatusMessage(once, '2', { status: 'active', userId: 2, userName: 'Frank' });
        expect(twice).toEqual({ 2: { status: 'active', userId: 2, userName: 'Frank' } });
    });

    it('never mutates its input', () => {
        const current = { 2: { status: 'inactive' } };
        const snapshot = JSON.parse(JSON.stringify(current));
        applyFilmStatusMessage(current, '2', { status: 'active', userId: 2, userName: 'Frank' });
        expect(current).toEqual(snapshot);
    });
});

describe('removeDeletedFilms', () => {
    // This is the exact logic FilmsToReviewPage.jsx uses to drop a deleted
    // film from its own `films` state (not just from what's rendered),
    // which also shrinks the id set passed to useFilmSelectionMqtt and so
    // drives MQTT unsubscription via connectFilmSelectionMqtt's set-diffing.
    const films = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }, { id: 3, title: 'C' }];

    it('removes exactly the film(s) marked deleted', () => {
        const statusMap = { 2: { status: 'deleted' } };
        const next = removeDeletedFilms(films, statusMap);
        expect(next.map((f) => f.id)).toEqual([1, 3]);
    });

    it('removes multiple deleted films at once', () => {
        const statusMap = { 1: { status: 'deleted' }, 3: { status: 'deleted' } };
        const next = removeDeletedFilms(films, statusMap);
        expect(next.map((f) => f.id)).toEqual([2]);
    });

    it('keeps every film when none are marked deleted', () => {
        const statusMap = { 1: { status: 'active', userId: 2, userName: 'Frank' }, 2: { status: 'inactive' } };
        const next = removeDeletedFilms(films, statusMap);
        expect(next.map((f) => f.id)).toEqual([1, 2, 3]);
    });

    it('returns the SAME array reference when nothing was removed (avoids a redundant re-render)', () => {
        const statusMap = { 1: { status: 'inactive' } };
        const next = removeDeletedFilms(films, statusMap);
        expect(next).toBe(films);
    });

    it('returns a new array reference when something was removed', () => {
        const statusMap = { 2: { status: 'deleted' } };
        const next = removeDeletedFilms(films, statusMap);
        expect(next).not.toBe(films);
    });

    it('handles an empty status map (nothing known yet) by keeping all films', () => {
        expect(removeDeletedFilms(films, {})).toBe(films);
    });

    it('never mutates its input array', () => {
        const snapshot = films.map((f) => ({ ...f }));
        removeDeletedFilms(films, { 2: { status: 'deleted' } });
        expect(films).toEqual(snapshot);
    });
});
