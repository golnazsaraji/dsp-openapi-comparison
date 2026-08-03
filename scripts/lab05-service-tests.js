// Direct FilmManagerService (no HTTP) coverage for Lab05: the exclusive
// active-film invariant, atomic mutation ordering, 'filmStatusChanged' event
// emission (creation/selection/replacement/clear/deletion/invitation-removal),
// exact event count/order/payload, near-concurrent competing selections, and
// that events fire only for successful operations that actually changed
// film-level state. Mirrors scripts/lab04-service-tests.js.
const assert = require('assert');
const service = require('../shared-services/src/services/FilmManagerService');

function status(action, expected, label) {
    assert.throws(action, (error) => error.status === expected, label);
}

function collectFilmStatusChanged() {
    const events = [];
    const handler = (event) => events.push(event);
    service.on('filmStatusChanged', handler);
    return { events, stop: () => service.removeListener('filmStatusChanged', handler) };
}

function collectUpdate() {
    const events = [];
    const handler = (event) => events.push(event);
    service.on('update', handler);
    return { events, stop: () => service.removeListener('update', handler) };
}

(async () => {
    // --- 1. first user selects a film successfully; exact event count/order/payload ---
    service.currentUserId = 2; // Frank: invited reviewer for films 1 and 2 (seed data)
    {
        const { events, stop } = collectFilmStatusChanged();
        const result = service.filmsFilmIdActivePUT(2);
        assert.strictEqual(result.active, true, 'Frank selects film 2 successfully');
        // Frank's previous active film (1, from seed data) becomes inactive, then film 2 becomes active.
        assert.strictEqual(events.length, 2, 'exactly two filmStatusChanged events for a replacing selection');
        assert.deepStrictEqual(events[0], { filmId: 1, message: { status: 'inactive' } }, 'event 1 payload must be exactly { filmId, message }, semantic data only');
        assert.deepStrictEqual(events[1], { filmId: 2, message: { status: 'active', userId: 2, userName: 'Frank' } }, 'event 2 payload must be exactly { filmId, message }, semantic data only');
        // No MQTT transport option (qos/retain/broker/client) anywhere on the event payload.
        assert.deepStrictEqual(Object.keys(events[1]).sort(), ['filmId', 'message']);
        stop();
    }

    // --- 2. second user selecting the same film receives 409; both users' prior state is unchanged ---
    service.currentUserId = 3; // Karen: also invited for film 2 (seed data), currently inactive there
    {
        const { events, stop } = collectFilmStatusChanged();
        const { events: updateEvents, stop: stopUpdate } = collectUpdate();
        status(() => service.filmsFilmIdActivePUT(2), 409, 'a second user selecting an already-active public film receives 409');
        assert.strictEqual(events.length, 0, 'a failed (409) selection must emit no filmStatusChanged event');
        assert.strictEqual(updateEvents.length, 0, 'a failed (409) selection must not broadcast a WebSocket update either');
        stop();
        stopUpdate();
    }
    assert.strictEqual(
        service.reviews.find((r) => r.filmId === 2 && r.reviewerId === 2).active,
        true,
        "Frank's active selection must remain unchanged after Karen's failed conflicting selection",
    );
    assert.strictEqual(
        service.reviews.find((r) => r.filmId === 2 && r.reviewerId === 3).active,
        false,
        "Karen's own active state must remain unchanged (still inactive) after her failed selection",
    );

    // --- 2b. a user with their OWN active film retains it after a failed conflicting selection elsewhere ---
    service.currentUserId = 1;
    const filmP = service.filmsPOST({ title: 'Conflict Target P', private: false });
    const filmQ = service.filmsPOST({ title: "Karen's Own Film Q", private: false });
    service.filmsFilmIdReviewsPOST(filmP.id, [{ reviewerId: 2 }, { reviewerId: 3 }]);
    service.filmsFilmIdReviewsPOST(filmQ.id, { reviewerId: 3 });
    service.currentUserId = 2;
    service.filmsFilmIdActivePUT(filmP.id); // Frank activates P
    service.currentUserId = 3;
    service.filmsFilmIdActivePUT(filmQ.id); // Karen activates her own, unrelated film Q first
    status(() => service.filmsFilmIdActivePUT(filmP.id), 409, "Karen attempting Frank's already-active film P fails while she already has Q active");
    assert.strictEqual(
        service.reviews.find((r) => r.filmId === filmQ.id && r.reviewerId === 3).active,
        true,
        "Karen's own previously active film Q must remain active after her failed attempt on P",
    );
    assert.strictEqual(
        service.reviews.find((r) => r.filmId === filmP.id && r.reviewerId === 2).active,
        true,
        "Frank's active film P must remain unaffected",
    );

    // --- 2c. near-concurrent competing selections: exactly one wins, deterministically ---
    // Both requests are deferred onto the microtask queue (Promise.resolve().then(...))
    // instead of called back-to-back synchronously, so this proves the outcome under
    // near-simultaneous dispatch, not merely sequential dispatch order chosen by the
    // test itself. Node's single-threaded, run-to-completion event loop means the two
    // synchronous handler invocations still can never truly interleave — this proves a
    // PROCESS-LOCAL guarantee only. It does NOT prove cross-process/cross-instance
    // mutual exclusion: a horizontally-scaled deployment (multiple Node processes
    // sharing state through a database, cache, or queue instead of this in-memory
    // array) would need its own external locking/transaction strategy. See
    // docs/lab05-implementation.md ("Horizontal-scaling requirements").
    service.currentUserId = 1;
    const raceFilm = service.filmsPOST({ title: 'Race Target', private: false });
    service.filmsFilmIdReviewsPOST(raceFilm.id, [{ reviewerId: 2 }, { reviewerId: 3 }]);
    const attempt = (userId) => Promise.resolve().then(() => {
        service.currentUserId = userId;
        return service.filmsFilmIdActivePUT(raceFilm.id);
    });
    const raceOutcomes = await Promise.allSettled([attempt(2), attempt(3)]);
    const fulfilled = raceOutcomes.filter((o) => o.status === 'fulfilled');
    const rejected = raceOutcomes.filter((o) => o.status === 'rejected');
    assert.strictEqual(fulfilled.length, 1, 'exactly one of two near-concurrent competing selections must succeed');
    assert.strictEqual(rejected.length, 1, 'exactly one of two near-concurrent competing selections must fail');
    assert.strictEqual(rejected[0].reason.status, 409, 'the losing near-concurrent request must fail with 409, not a different error');
    assert.strictEqual(
        service.reviews.filter((r) => r.filmId === raceFilm.id && r.active).length,
        1,
        'exactly one review for the contested film must end up active after the race',
    );

    // --- 3. switching A to B emits A inactive then B active, in that order, exactly once each ---
    service.currentUserId = 4; // Rene: invited reviewer for film 4 only (seed data)
    {
        const { events, stop } = collectFilmStatusChanged();
        service.filmsFilmIdActivePUT(4); // first selection: only B(4) active, no prior A
        assert.deepStrictEqual(events.map((e) => [e.filmId, e.message.status]), [[4, 'active']]);
        stop();
    }
    // Give Rene a second assignment to replace film 4 with, isolated from other scenarios.
    service.currentUserId = 1;
    const switchFilm = service.filmsPOST({ title: 'Switch Target', private: false });
    service.filmsFilmIdReviewsPOST(switchFilm.id, { reviewerId: 4 });
    service.currentUserId = 4;
    {
        const { events, stop } = collectFilmStatusChanged();
        const result = service.filmsFilmIdActivePUT(switchFilm.id);
        assert.strictEqual(result.active, true);
        assert.deepStrictEqual(
            events.map((e) => [e.filmId, e.message.status]),
            [[4, 'inactive'], [switchFilm.id, 'active']],
            'replacing A with B must emit A inactive, then B active, in that order, each exactly once',
        );
        assert.strictEqual(events.filter((e) => e.filmId === 4).length, 1, 'film A must emit exactly once');
        assert.strictEqual(events.filter((e) => e.filmId === switchFilm.id).length, 1, 'film B must emit exactly once');
        stop();
    }

    // --- 4. selecting the same film for the same user is fully idempotent: no filmStatusChanged AND no WebSocket update ---
    {
        const { events, stop } = collectFilmStatusChanged();
        const { events: updateEvents, stop: stopUpdate } = collectUpdate();
        const result = service.filmsFilmIdActivePUT(switchFilm.id);
        assert.strictEqual(result.active, true, 'reselecting the already-active film still succeeds');
        assert.strictEqual(events.length, 0, 'reselecting the same already-active film must not re-publish any filmStatusChanged event');
        assert.strictEqual(
            updateEvents.length, 0,
            'reselecting the same already-active film must not rebroadcast a WebSocket update either — the authoritative '
            + 'specifications/lab04/material/Lab04.pdf lists "selects a NEW film" as the broadcast trigger, not every call',
        );
        stop();
        stopUpdate();
    }

    // --- 5. clearing emits inactive exactly once ---
    {
        const { events, stop } = collectFilmStatusChanged();
        service.usersCurrentActiveFilmDELETE();
        assert.deepStrictEqual(events.map((e) => [e.filmId, e.message.status]), [[switchFilm.id, 'inactive']]);
        assert.strictEqual(events.length, 1, 'clearing must emit exactly one filmStatusChanged event');
        stop();
    }

    // --- 5b. clearing with no active film emits nothing ---
    {
        const { events, stop } = collectFilmStatusChanged();
        service.usersCurrentActiveFilmDELETE(); // already cleared above
        assert.strictEqual(events.length, 0, 'clearing when there is no active film must emit nothing');
        stop();
    }

    // --- 6. public creation emits inactive; private creation emits nothing ---
    service.currentUserId = 1;
    {
        const { events, stop } = collectFilmStatusChanged();
        const publicFilm = service.filmsPOST({ title: 'Public Creation Target', private: false });
        assert.deepStrictEqual(events, [{ filmId: publicFilm.id, message: { status: 'inactive' } }]);
        stop();
    }
    {
        const { events, stop } = collectFilmStatusChanged();
        service.filmsPOST({ title: 'Private Creation Target', private: true });
        assert.strictEqual(events.length, 0, 'creating a private film must emit no filmStatusChanged event');
        stop();
    }

    // --- 7. public deletion emits deleted exactly once; private deletion emits nothing ---
    service.currentUserId = 1;
    const deletionTargetPublic = service.filmsPOST({ title: 'Public Deletion Target', private: false });
    {
        const { events, stop } = collectFilmStatusChanged();
        service.filmsFilmIdDELETE(deletionTargetPublic.id);
        assert.deepStrictEqual(events, [{ filmId: deletionTargetPublic.id, message: { status: 'deleted' } }]);
        stop();
    }
    const deletionTargetPrivate = service.filmsPOST({ title: 'Private Deletion Target', private: true });
    {
        const { events, stop } = collectFilmStatusChanged();
        service.filmsFilmIdDELETE(deletionTargetPrivate.id);
        assert.strictEqual(events.length, 0, 'deleting a private film must emit no filmStatusChanged event');
        stop();
    }

    // --- 8. invitation removal that invalidates the film's one active selection republishes inactive ---
    service.currentUserId = 1;
    const invitationTarget = service.filmsPOST({ title: 'Invitation Removal Target', private: false });
    service.filmsFilmIdReviewsPOST(invitationTarget.id, { reviewerId: 3 }); // Karen invited
    service.currentUserId = 3;
    service.filmsFilmIdActivePUT(invitationTarget.id);
    service.currentUserId = 1;
    {
        const { events, stop } = collectFilmStatusChanged();
        const { events: updateEvents, stop: stopUpdate } = collectUpdate();

        service.filmsFilmIdReviewsReviewerIdDELETE(invitationTarget.id, 3);

        assert.deepStrictEqual(
            events,
            [{ filmId: invitationTarget.id, message: { status: 'inactive' } }],
            'removing the invitation behind the film\'s one active selection must republish the film as inactive, exactly once',
        );
        assert.strictEqual(updateEvents.length, 1, 'the WebSocket corrective update must still fire for the affected reviewer');
        assert.strictEqual(updateEvents[0].userId, 3);
        stop();
        stopUpdate();
    }

    // --- 8b. removing an inactive (never-active) invitation emits no filmStatusChanged ---
    service.currentUserId = 1;
    const inactiveInvitationTarget = service.filmsPOST({ title: 'Inactive Invitation Target', private: false });
    service.filmsFilmIdReviewsPOST(inactiveInvitationTarget.id, { reviewerId: 3 });
    {
        const { events, stop } = collectFilmStatusChanged();
        service.filmsFilmIdReviewsReviewerIdDELETE(inactiveInvitationTarget.id, 3);
        assert.strictEqual(events.length, 0, 'removing a never-active invitation must emit no filmStatusChanged event');
        stop();
    }

    // --- 9. conflict error never leaks the current holder's identity ---
    service.currentUserId = 1;
    const leakFilm = service.filmsPOST({ title: 'Leak Check Target', private: false });
    service.filmsFilmIdReviewsPOST(leakFilm.id, [{ reviewerId: 2 }, { reviewerId: 3 }]);
    service.currentUserId = 2;
    service.filmsFilmIdActivePUT(leakFilm.id);
    service.currentUserId = 3;
    try {
        service.filmsFilmIdActivePUT(leakFilm.id);
        assert.fail('expected a 409 conflict error');
    } catch (error) {
        assert.strictEqual(error.status, 409);
        assert.ok(!/frank/i.test(error.message), 'the conflict error message must not name the current holder');
        assert.ok(!/\b2\b/.test(error.message), 'the conflict error message must not include the current holder\'s userId');
    }

    service.currentUserId = null;
    console.log('Lab05 FilmManagerService tests passed (exclusivity conflict, atomicity, near-concurrent race, event count/order/payload, idempotent reselect incl. WS, creation/selection/replacement/clear/deletion/invitation-removal triggers, no-identity-leak).');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
