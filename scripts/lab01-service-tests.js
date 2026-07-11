const assert = require('assert');
const service = require('../shared-services/src/services/FilmManagerService');

function status(action, expected) {
    assert.throws(action, (error) => error.status === expected);
}

(async () => {
    assert.strictEqual(await service.verifyCredentials('frank@example.com', 'password').then((user) => user.id), 2);
    assert.strictEqual(await service.verifyCredentials('frank@example.com', 'wrong'), null);
    assert.strictEqual(await service.verifyCredentials('missing@example.com', 'password'), null);
    assert.strictEqual(service.internalUser(2).password, undefined);
    assert.match(service.internalUser(2).passwordHash, /^\$2[aby]\$/);

    service.currentUserId = null;
    status(() => service.filmsGET(), 401);
    service.currentUserId = 2;
    assert.deepStrictEqual(service.filmsGET().films.map((film) => film.id), [3]);
    assert.strictEqual(service.usersGET().some((user) => 'password' in user || 'passwordHash' in user), false);

    const privateFilm = service.filmsPOST({ title: 'Private workflow', private: true, rating: 0, favorite: false });
    assert.strictEqual(service.filmsFilmIdGET(privateFilm.id).id, privateFilm.id);
    status(() => service.filmsFilmIdPUT(privateFilm.id, { title: 'Visibility change', private: false }), 409);

    const created = service.filmsPOST({ title: 'Owner-scoped assignment', private: false });
    service.currentUserId = 1;
    const otherOwnerFilm = service.filmsPOST({ title: 'Other owner eligible film', private: false });
    service.currentUserId = 2;
    const assignments = service.reviewsAutoInvitationsPOST();
    assert(assignments.items.some((review) => review.filmId === created.id));
    assert(!assignments.items.some((review) => review.filmId === otherOwnerFilm.id));
    assert(!assignments.items.some((review) => review.filmId === privateFilm.id));
    assert.strictEqual(service.reviewsAutoInvitationsPOST().items.length, 0);

    const invitationFilm = service.filmsPOST({ title: 'Bulk invitations', private: false });
    const invitations = service.filmsFilmIdReviewsPOST(invitationFilm.id, [{ reviewerId: 3 }, { filmId: invitationFilm.id, reviewerId: 4 }]);
    assert.deepStrictEqual(invitations.map((review) => review.reviewerId), [3, 4]);
    status(() => service.filmsFilmIdReviewsPOST(invitationFilm.id, [{ reviewerId: 3 }]), 409);
    status(() => service.filmsFilmIdReviewsPOST(invitationFilm.id, [{ filmId: 999, reviewerId: 1 }]), 400);

    const removableFilm = service.filmsPOST({ title: 'Removal workflow', private: false });
    assert.strictEqual(service.filmsFilmIdReviewsPOST(removableFilm.id, [{ reviewerId: 2 }])[0].reviewerId, 2);
    assert.strictEqual(service.filmsFilmIdReviewsReviewerIdDELETE(removableFilm.id, 2), true);

    service.currentUserId = 1;
    status(() => service.filmsFilmIdGET(privateFilm.id), 404);
    status(() => service.filmsFilmIdPUT(privateFilm.id, { title: 'Forbidden', private: true }), 403);
    status(() => service.filmsFilmIdDELETE(privateFilm.id), 403);
    status(() => service.filmsFilmIdReviewsPOST(invitationFilm.id, [{ reviewerId: 1 }]), 403);
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, { completed: true, reviewDate: '2026-07-11', rating: 5, review: 'No invitation' }), 404);

    service.currentUserId = 3;
    assert.strictEqual(service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true,
        reviewDate: '2026-07-11',
        rating: 0,
        review: 'Valid lower-bound rating.',
    }), null);
    assert.strictEqual(service.filmsPublicFilmIdReviewsReviewerIdGET(invitationFilm.id, 3).completed, true);

    service.currentUserId = 2;
    status(() => service.filmsFilmIdReviewsReviewerIdDELETE(invitationFilm.id, 3), 409);
    service.currentUserId = null;
    assert(service.filmsPublicFilmIdReviewsGET(invitationFilm.id).reviews.some((review) => review.reviewerId === 3));
    assert.strictEqual(service.filmsPublicFilmIdReviewsReviewerIdGET(invitationFilm.id, 3).self, `/api/films/public/${invitationFilm.id}/reviews/3`);
    const page = service.filmsPublicGET(1, 1);
    assert.strictEqual(page.currentPage, 1);
    assert.strictEqual(page.films.length, 1);
    assert(page.next.endsWith('page=2&limit=1'));
    assert(!JSON.stringify(page).includes('/change/me'));

    console.log('Lab01 shared-service tests passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
