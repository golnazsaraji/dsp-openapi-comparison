// Pure reducer for Lab05 live film-selection status: given the current
// { [filmId]: { status, userId?, userName? } } map and one incoming MQTT
// (topic, message) pair, returns the next map. No React dependency, so it is
// unit-testable in plain Node (mirrors ../realtime/onlineListReducer.js) and
// safe to call from a functional setState updater (never mutates its input).
const VALID_STATUSES = new Set(['active', 'inactive', 'deleted']);

export function applyFilmStatusMessage(filmStatusByFilmId, topic, message) {
    const current = (filmStatusByFilmId && typeof filmStatusByFilmId === 'object') ? filmStatusByFilmId : {};

    // The topic IS the film id (see specifications/lab05/README.md) — a topic
    // that doesn't parse to a positive integer belongs to no known film.
    const filmId = Number(topic);
    if (!Number.isInteger(filmId) || filmId <= 0) return current;

    if (!message || typeof message !== 'object' || !VALID_STATUSES.has(message.status)) {
        return current; // malformed or unrecognized message: ignore defensively.
    }

    if (message.status === 'deleted') {
        // A 'deleted' status is stored as a marker entry, not removed from
        // the map: FilmsToReviewPage.jsx filters visible films by checking
        // `.status !== 'deleted'`, so the marker must actually be present
        // for that check to work. (Deleting the key here instead would
        // leave `filmStatusByFilmId[filmId]` `undefined`, and
        // `undefined?.status !== 'deleted'` is `true` — the film would
        // incorrectly stay visible.)
        if (current[filmId]?.status === 'deleted') return current; // idempotent: already marked deleted.
        return { ...current, [filmId]: { status: 'deleted' } };
    }

    if (message.status === 'inactive') {
        return { ...current, [filmId]: { status: 'inactive' } };
    }

    // 'active': the canonical schema requires userId and userName together.
    if (typeof message.userId !== 'number' || typeof message.userName !== 'string' || message.userName.length === 0) {
        return current;
    }
    return { ...current, [filmId]: { status: 'active', userId: message.userId, userName: message.userName } };
}

// Pure companion to applyFilmStatusMessage: given the current films-to-review
// list and the live status map, returns the list with any film marked
// 'deleted' removed. Returns the SAME array reference when nothing changed,
// so a caller using this inside a React state updater never triggers a
// redundant re-render. Extracted specifically so FilmsToReviewPage.jsx's
// deleted-film removal (which also drives MQTT unsubscription — see
// connectFilmSelectionMqtt.js's setFilmIds diffing) is unit-testable without
// a component-rendering harness.
export function removeDeletedFilms(films, filmStatusByFilmId) {
    const current = Array.isArray(films) ? films : [];
    const next = current.filter((film) => filmStatusByFilmId[film.id]?.status !== 'deleted');
    return next.length === current.length ? current : next;
}
