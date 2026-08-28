import { describe, it, expect } from 'vitest';
import { applyOnlineStatusMessage } from '../realtime/onlineListReducer';

describe('applyOnlineStatusMessage', () => {
    it('adds a new user on login', () => {
        const result = applyOnlineStatusMessage([], { typeMessage: 'login', userId: 2, userName: 'Frank' });
        expect(result).toEqual([{ userId: 2, userName: 'Frank' }]);
    });

    it('adds filmId/filmTitle when present on login', () => {
        const result = applyOnlineStatusMessage([], {
            typeMessage: 'login', userId: 2, userName: 'Frank', filmId: 1, filmTitle: 'The Matrix',
        });
        expect(result).toEqual([{ userId: 2, userName: 'Frank', filmId: 1, filmTitle: 'The Matrix' }]);
    });

    it('does not duplicate a user already in the list on a second login message', () => {
        const withFrank = [{ userId: 2, userName: 'Frank' }];
        const result = applyOnlineStatusMessage(withFrank, { typeMessage: 'login', userId: 2, userName: 'Frank' });
        expect(result).toHaveLength(1);
    });

    it('replaces the existing entry on update rather than duplicating', () => {
        const withFrank = [{ userId: 2, userName: 'Frank' }];
        const result = applyOnlineStatusMessage(withFrank, {
            typeMessage: 'update', userId: 2, userName: 'Frank', filmId: 2, filmTitle: 'Arrival',
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ userId: 2, userName: 'Frank', filmId: 2, filmTitle: 'Arrival' });
    });

    it('update can clear the active film by omitting filmId', () => {
        const withActiveFilm = [{ userId: 2, userName: 'Frank', filmId: 2, filmTitle: 'Arrival' }];
        const result = applyOnlineStatusMessage(withActiveFilm, { typeMessage: 'update', userId: 2, userName: 'Frank' });
        expect(result[0]).toEqual({ userId: 2, userName: 'Frank' });
    });

    it('removes the user on logout', () => {
        const withFrank = [{ userId: 2, userName: 'Frank' }, { userId: 3, userName: 'Karen' }];
        const result = applyOnlineStatusMessage(withFrank, { typeMessage: 'logout', userId: 2 });
        expect(result).toEqual([{ userId: 3, userName: 'Karen' }]);
    });

    it('logout for a user not in the list is a no-op', () => {
        const withKaren = [{ userId: 3, userName: 'Karen' }];
        const result = applyOnlineStatusMessage(withKaren, { typeMessage: 'logout', userId: 99 });
        expect(result).toEqual(withKaren);
    });

    it('adding a second, different user does not affect the first', () => {
        const withFrank = [{ userId: 2, userName: 'Frank' }];
        const result = applyOnlineStatusMessage(withFrank, { typeMessage: 'login', userId: 3, userName: 'Karen' });
        expect(result).toEqual([{ userId: 2, userName: 'Frank' }, { userId: 3, userName: 'Karen' }]);
    });

    it('ignores a malformed/unknown message type defensively', () => {
        const withFrank = [{ userId: 2, userName: 'Frank' }];
        expect(applyOnlineStatusMessage(withFrank, { typeMessage: 'bogus', userId: 2 })).toEqual(withFrank);
        expect(applyOnlineStatusMessage(withFrank, null)).toEqual(withFrank);
        expect(applyOnlineStatusMessage(withFrank, {})).toEqual(withFrank);
    });

    it('never mutates the input array (functional update safety)', () => {
        const original = [{ userId: 2, userName: 'Frank' }];
        const originalCopy = [...original];
        applyOnlineStatusMessage(original, { typeMessage: 'login', userId: 3, userName: 'Karen' });
        expect(original).toEqual(originalCopy);
    });
});
