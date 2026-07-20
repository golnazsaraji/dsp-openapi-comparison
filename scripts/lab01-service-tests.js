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
    const currentUser = service.sessionsCurrentGET();
    assert.deepStrictEqual(Object.keys(currentUser).sort(), ['email', 'id', 'name', 'self']);
    assert.strictEqual(currentUser.self, '/api/users/2');

    const privateFilm = service.filmsPOST({ title: 'Private workflow', private: true, rating: 0, favorite: false });
    assert.strictEqual(service.filmsFilmIdGET(privateFilm.id).id, privateFilm.id);
    status(() => service.filmsFilmIdPUT(privateFilm.id, { title: 'Visibility change', private: false }), 409);

    const created = service.filmsPOST({ title: 'Owner-scoped assignment', private: false });
    const publicPage = service.filmsPublicGET(1, 100);
    assert(publicPage.films.some((film) => film.id === created.id));
    assert(publicPage.films.every((film) => !('watchDate' in film) && !('rating' in film) && !('favorite' in film)));
    assert.deepStrictEqual(publicPage.films.map((film) => film.id), [...publicPage.films.map((film) => film.id)].sort((a, b) => a - b));
    status(() => service.filmsPublicGET(0, 10), 400);
    status(() => service.filmsPublicGET(1, 0), 400);
    status(() => service.filmsPublicGET(1, 101), 400);
    status(() => service.filmsPOST({ private: false }), 400);
    status(() => service.filmsPOST({ title: 'Missing private' }), 400);
    status(() => service.filmsPOST({ title: 'Wrong type', private: 'false' }), 400);
    status(() => service.filmsPOST({ title: 'Bad date', private: true, watchDate: '11-07-2026' }), 400);
    status(() => service.filmsPOST({ title: 'Impossible date', private: true, watchDate: '2026-02-30' }), 400);
    status(() => service.filmsPOST({ title: 'April overflow', private: true, watchDate: '2026-04-31' }), 400);
    status(() => service.filmsPOST({ title: 'Invalid leap day', private: true, watchDate: '2025-02-29' }), 400);
    status(() => service.filmsPOST({ title: 'Invalid month', private: true, watchDate: '2026-13-01' }), 400);
    status(() => service.filmsPOST({ title: 'Invalid day', private: true, watchDate: '2026-01-00' }), 400);
    assert.strictEqual(service.filmsPOST({ title: 'Valid leap day', private: true, watchDate: '2024-02-29' }).watchDate, '2024-02-29');
    status(() => service.filmsPOST({ title: 'Unknown field', private: false, unexpected: true }), 400);
    service.currentUserId = 1;
    const otherOwnerFilm = service.filmsPOST({ title: 'Other owner eligible film', private: false });
    service.currentUserId = 2;
    const assignments = service.reviewsAutoInvitationsPOST();
    assert(assignments.some((review) => review.filmId === created.id));
    assert(!assignments.some((review) => review.filmId === otherOwnerFilm.id));
    assert(!assignments.some((review) => review.filmId === privateFilm.id));
    assert.strictEqual(service.reviewsAutoInvitationsPOST().length, 0);

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
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, { completed: true, reviewDate: '2026-07-11', rating: 5, review: 'No invitation' }), 403);

    service.currentUserId = 3;
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true, reviewDate: '11-07-2026', rating: 5, review: 'Bad date',
    }), 400);
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true, reviewDate: '2026-02-30', rating: 5, review: 'Impossible date',
    }), 400);
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true, reviewDate: '2026-04-31', rating: 5, review: 'April overflow',
    }), 400);
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true, reviewDate: '2025-02-29', rating: 5, review: 'Invalid leap day',
    }), 400);
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true, reviewDate: '2026-13-01', rating: 5, review: 'Invalid month',
    }), 400);
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true, reviewDate: '2026-01-00', rating: 5, review: 'Invalid day',
    }), 400);
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true, reviewDate: '2026-07-11', rating: -1, review: 'Bad rating',
    }), 400);
    status(() => service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true, reviewDate: '2026-07-11', rating: 11, review: 'Bad rating',
    }), 400);
    assert.strictEqual(service.filmsFilmIdReviewsCurrentPUT(invitationFilm.id, {
        completed: true,
        reviewDate: '2026-07-11',
        rating: 0,
        review: 'Valid lower-bound rating.',
    }), null);
    const completedReview = service.filmsPublicFilmIdReviewsReviewerIdGET(invitationFilm.id, 3);
    assert.strictEqual(completedReview.completed, true);
    assert.strictEqual(completedReview.reviewDate, '2026-07-11');

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

    service.currentUserId = 2;
    const image = service.filmsFilmIdImagesPOST(created.id, 'service-test.jpg');
    assert.deepStrictEqual(Object.keys(image).sort(), ['filmId', 'id', 'mediaType', 'name', 'self']);
    assert.strictEqual(image.filmId, created.id);
    assert.strictEqual(image.name, 'service-test.jpg');
    assert.strictEqual(image.mediaType, 'image/jpeg');
    assert.strictEqual(image.self, `/api/films/${created.id}/images/${image.id}`);

    console.log('Lab01 shared-service tests passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
