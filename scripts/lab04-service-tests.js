// Direct FilmManagerService (no HTTP) coverage for Lab04: auth checks,
// assigned/unassigned reviewer, one-active-film-per-user, the two-users-same-film
// fix, deterministic snapshot ordering, multi-session-safe presence tracking,
// and that broadcast events fire only for successful operations, including
// active-state invalidation on invitation/film deletion.
const assert = require('assert');
const service = require('../shared-services/src/services/FilmManagerService');

function status(action, expected, label) {
    assert.throws(action, (error) => error.status === expected, label);
}

(async () => {
    // --- 1. authentication checks ---
    service.currentUserId = null;
    status(() => service.usersOnlineGET(), 401, 'usersOnlineGET requires auth');
    status(() => service.filmsFilmIdActivePUT(1), 401, 'filmsFilmIdActivePUT requires auth');
    status(() => service.usersCurrentActiveFilmDELETE(), 401, 'usersCurrentActiveFilmDELETE requires auth');

    // --- 2. assigned vs unassigned reviewer ---
    service.currentUserId = 2; // Frank: invited reviewer for films 1 and 2 (seed data)
    const frankActive1 = service.filmsFilmIdActivePUT(1);
    assert.strictEqual(frankActive1.active, true, 'Frank can select film 1 (he is an invited reviewer)');

    service.currentUserId = 1; // Alice: not an invited reviewer for any seed film
    status(() => service.filmsFilmIdActivePUT(1), 403, 'a non-reviewer cannot select a film as active');
    status(() => service.filmsFilmIdActivePUT(999), 404, 'selecting a non-existent film is 404');

    // --- 3. at most one active film per user ---
    service.currentUserId = 2;
    const frankActive2 = service.filmsFilmIdActivePUT(2);
    assert.strictEqual(frankActive2.active, true, 'selecting film 2 activates it for Frank');
    // Confirm film 1 is no longer active for Frank (deactivated by the new selection).
    assert.strictEqual(
        service.reviews.filter((review) => review.reviewerId === 2 && review.active).length,
        1,
        'Frank must have at most one active review at a time',
    );
    assert.strictEqual(
        service.reviews.find((review) => review.reviewerId === 2 && review.filmId === 1).active,
        false,
        "Frank's previous active film (1) must be deactivated",
    );

    // --- 4. two different users MAY select the same film (the fixed exclusivity rule) ---
    service.currentUserId = 3; // Karen: also invited for film 2 (seed data)
    const karenActive2 = service.filmsFilmIdActivePUT(2);
    assert.strictEqual(karenActive2.active, true, 'Karen can select film 2 even though Frank already has it active');
    assert.strictEqual(
        service.reviews.find((review) => review.reviewerId === 2 && review.filmId === 2).active,
        true,
        "Frank's active film 2 must be unaffected by Karen selecting the same film",
    );

    // --- 5. deterministic snapshot ordering (ascending numeric userId), independent of login order ---
    service.sessionIdsByUserId.clear();
    service.recordLogin(4, 'sess-4a');
    service.recordLogin(2, 'sess-2a');
    service.recordLogin(3, 'sess-3a');
    assert.deepStrictEqual(
        service.webSocketSnapshot().map((message) => message.userId),
        [2, 3, 4],
        'snapshot must be sorted by ascending numeric userId regardless of login order',
    );
    // The snapshot must list each online user exactly once, even though every
    // user here has exactly one session (sanity check for the next section,
    // which adds a second session for the same user).
    assert.strictEqual(service.webSocketSnapshot().length, 3, 'snapshot must contain each online user exactly once');
    service.sessionIdsByUserId.clear();

    // --- 6. real session-identity tracking (not a boolean/count) ---
    {
        const loginEvents = [];
        const logoutEvents = [];
        service.on('login', (m) => loginEvents.push(m));
        service.on('logout', (m) => logoutEvents.push(m));

        // 6a. first session login makes the user online.
        service.recordLogin(2, 'cookie-jar-A');
        assert.strictEqual(service.isUserOnline(2), true, 'user online after first session login');
        assert.strictEqual(loginEvents.length, 1, 'first session login broadcasts exactly one login event');

        // 6b. repeated login using the SAME session id (e.g. the same cookie
        // jar submitting the login form twice) must be idempotent: no second
        // login event, and the user must still show up exactly once in the
        // snapshot (not double-counted).
        service.recordLogin(2, 'cookie-jar-A');
        assert.strictEqual(loginEvents.length, 1, 'repeated login from the same session must not re-broadcast login');
        assert.strictEqual(service.sessionIdsByUserId.get(2).size, 1, 'the same session id must not be double-counted');
        assert.strictEqual(
            service.webSocketSnapshot().filter((m) => m.userId === 2).length,
            1,
            'the snapshot must list the user exactly once after a repeated same-session login',
        );

        // 6c. logging out that single (repeated-login) session must correctly
        // mark the user offline, broadcasting exactly one logout.
        service.recordLogout(2, 'cookie-jar-A');
        assert.strictEqual(service.isUserOnline(2), false, 'logout after a repeated same-session login must mark the user offline');
        assert.strictEqual(logoutEvents.length, 1, 'logout after a repeated same-session login broadcasts exactly one logout event');
        assert.deepStrictEqual(logoutEvents[0], { typeMessage: 'logout', userId: 2 });

        // 6d. two independent sessions (e.g. two different browsers/cookie
        // jars) for the same user must both be tracked, multi-session-safe:
        // the user stays online until the LAST of the two logs out, and each
        // session can only be removed by its own id.
        service.recordLogin(2, 'cookie-jar-A');
        assert.strictEqual(loginEvents.length, 2, 'logging back in after a full logout broadcasts a new login event');
        service.recordLogin(2, 'cookie-jar-B');
        assert.strictEqual(loginEvents.length, 2, 'a second, different session for an already-online user must not re-broadcast login');
        assert.strictEqual(service.sessionIdsByUserId.get(2).size, 2, 'two independent sessions must both be tracked for the same user');

        // 6e. logout from an unknown/unregistered session id must be a no-op:
        // it must not decrement or remove either of the two real sessions.
        service.recordLogout(2, 'cookie-jar-never-logged-in');
        assert.strictEqual(service.isUserOnline(2), true, 'logout from an unregistered session must not affect real sessions');
        assert.strictEqual(service.sessionIdsByUserId.get(2).size, 2, 'an unregistered-session logout must not remove a real session');
        assert.strictEqual(logoutEvents.length, 1, 'an unregistered-session logout must not broadcast logout');

        // 6f. logout removes only the current (named) session; the user
        // remains online while the other session is still open.
        service.recordLogout(2, 'cookie-jar-A');
        assert.strictEqual(service.isUserOnline(2), true, 'user remains online while a second session is still open');
        assert.strictEqual(service.sessionIdsByUserId.get(2).size, 1, 'only the logged-out session must be removed');
        assert.strictEqual(logoutEvents.length, 1, 'closing one of two sessions must not broadcast logout');

        // 6g. the final session logout emits exactly one logout event.
        service.recordLogout(2, 'cookie-jar-B');
        assert.strictEqual(service.isUserOnline(2), false, 'user goes offline only after the final session closes');
        assert.strictEqual(logoutEvents.length, 2, 'the final session logout broadcasts exactly one additional logout event');
        assert.deepStrictEqual(logoutEvents[1], { typeMessage: 'logout', userId: 2 });

        // 6h. recordLogin requires a real session id — it must never fall
        // back to a boolean/anonymous "some session" concept.
        assert.throws(() => service.recordLogin(2, undefined), /requires a real session id/);
        assert.throws(() => service.recordLogin(2, null), /requires a real session id/);

        // 6i. Passport regenerates the session id on every successful login
        // (session-fixation protection), so a repeat login arriving with an
        // already-tracked cookie must be recognized via the id it arrived
        // WITH (previousSessionId), not just the brand-new post-regeneration
        // id — otherwise every real-world repeat login would look like an
        // unrelated new session and re-broadcast 'login'.
        service.recordLogin(2, 'regen-1'); // fresh login, tracked under regen-1
        assert.strictEqual(loginEvents.length, 3, 'a fresh login after full logout broadcasts a login event');
        service.recordLogin(2, 'regen-2', 'regen-1'); // same underlying session, passport rotated the id
        assert.strictEqual(loginEvents.length, 3, 'a same-session repeat login (rotated id) must not re-broadcast login');
        assert.strictEqual(service.sessionIdsByUserId.get(2).size, 1, 'a rotated same-session id must replace, not add to, the tracked session');
        assert.strictEqual(service.userIdBySessionId.has('regen-1'), false, 'the superseded session id must no longer be tracked');
        service.recordLogout(2, 'regen-2'); // logout using the final (rotated) id must still work
        assert.strictEqual(service.isUserOnline(2), false, 'logout using the rotated session id must mark the user offline');
        assert.strictEqual(logoutEvents.length, 3);

        service.removeAllListeners('login');
        service.removeAllListeners('logout');
    }

    // --- 7. broadcast only after successful REST-equivalent operations; nothing on failure ---
    {
        const updateEvents = [];
        service.on('update', (m) => updateEvents.push(m));

        service.currentUserId = 1; // Alice, not a reviewer for film 1
        status(() => service.filmsFilmIdActivePUT(1), 403, 'non-reviewer selection still fails');
        assert.strictEqual(updateEvents.length, 0, 'a failed active-film selection must not broadcast an update');

        service.currentUserId = 2;
        status(() => service.filmsFilmIdActivePUT(999), 404, 'missing film selection still fails');
        assert.strictEqual(updateEvents.length, 0, 'a failed (404) active-film selection must not broadcast an update');

        const successResult = service.filmsFilmIdActivePUT(1);
        assert.strictEqual(successResult.active, true);
        assert.strictEqual(updateEvents.length, 1, 'a successful active-film selection broadcasts exactly one update');
        assert.strictEqual(updateEvents[0].typeMessage, 'update');
        assert.strictEqual(updateEvents[0].userId, 2);
        assert.strictEqual(updateEvents[0].filmId, 1);

        service.usersCurrentActiveFilmDELETE();
        assert.strictEqual(updateEvents.length, 2, 'clearing the active film broadcasts exactly one more update');
        assert.strictEqual(updateEvents[1].filmId, undefined, 'the cleared-state update must carry no filmId');

        service.removeAllListeners('update');
    }

    // --- 8. active-state invalidation: removing an active invitation broadcasts a corrective update ---
    {
        service.currentUserId = 1; // Alice owns a new public film for this isolated scenario
        const film = service.filmsPOST({ title: 'Invalidation Target', private: false });
        service.filmsFilmIdReviewsPOST(film.id, { reviewerId: 4 }); // Rene invited

        service.currentUserId = 4;
        const activeResult = service.filmsFilmIdActivePUT(film.id);
        assert.strictEqual(activeResult.active, true);

        const updateEvents = [];
        service.on('update', (m) => updateEvents.push(m));

        service.currentUserId = 1; // owner removes Rene's invitation while it is active
        service.filmsFilmIdReviewsReviewerIdDELETE(film.id, 4);
        assert.strictEqual(updateEvents.length, 1, 'removing an active invitation must broadcast a corrective update');
        assert.strictEqual(updateEvents[0].userId, 4);
        assert.strictEqual(updateEvents[0].filmId, undefined, 'the corrective update must show no active film');

        service.removeAllListeners('update');
    }

    // --- 9. active-state invalidation: deleting a public film with an active review broadcasts a corrective update ---
    {
        service.currentUserId = 1;
        const film = service.filmsPOST({ title: 'Deletion Target', private: false });
        service.filmsFilmIdReviewsPOST(film.id, { reviewerId: 3 });

        service.currentUserId = 3;
        service.filmsFilmIdActivePUT(film.id);

        const updateEvents = [];
        service.on('update', (m) => updateEvents.push(m));

        service.currentUserId = 1;
        service.filmsFilmIdDELETE(film.id);
        assert.strictEqual(updateEvents.length, 1, 'deleting a film with an active reviewer must broadcast a corrective update');
        assert.strictEqual(updateEvents[0].userId, 3);
        assert.strictEqual(updateEvents[0].filmId, undefined);

        service.removeAllListeners('update');
    }

    service.currentUserId = null;
    console.log('Lab04 FilmManagerService tests passed (auth, reviewer assignment, exclusivity fix, snapshot ordering, multi-session presence, broadcast success/failure gating, active-state invalidation).');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
