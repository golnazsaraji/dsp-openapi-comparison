
const bcrypt = require('bcrypt');
const { AsyncLocalStorage } = require('async_hooks');
const { EventEmitter } = require('events');
const { isStrictCalendarDate } = require('../validation/date');
const ImageService = require('../images/ImageService');

// FilmManagerService emits 'login' / 'update' / 'logout' domain events with
// ready-to-broadcast WebSocket message payloads (see webSocketStatusMessage).
// This class never imports `ws` or knows about sockets: the realtime
// transport layer (shared-services/src/realtime) subscribes to these events
// instead, keeping the service transport-agnostic and unit-testable without a
// real WebSocket connection.
class FilmManagerService extends EventEmitter {
    constructor(options = {}) {
        super();
        this.users = [
            { id: 1, name: 'Alice', email: 'alice@example.com', passwordHash: bcrypt.hashSync('password', 10) },
            { id: 2, name: 'Frank', email: 'frank@example.com', passwordHash: bcrypt.hashSync('password', 10) },
            { id: 3, name: 'Karen', email: 'karen@example.com', passwordHash: bcrypt.hashSync('password', 10) },
            { id: 4, name: 'Rene', email: 'rene@example.com', passwordHash: bcrypt.hashSync('password', 10) },
        ];

        this.films = [
            { id: 1, title: 'The Matrix', ownerId: 1, public: true, watchDate: '2026-01-12', rating: 5, favorite: true },
            { id: 2, title: 'Arrival', ownerId: 1, public: true, watchDate: '2026-02-08', rating: 5, favorite: false },
            { id: 3, title: 'Private Notes', ownerId: 2, public: false, watchDate: '2026-03-10', rating: 3, favorite: false },
            { id: 4, title: 'Spirited Away', ownerId: 3, public: true, watchDate: '2026-04-02', rating: 5, favorite: true },
        ];

        this.reviews = [
            { filmId: 1, reviewerId: 2, completed: false, reviewDate: null, rating: null, description: null, active: true },
            { filmId: 2, reviewerId: 2, completed: false, reviewDate: null, rating: null, description: null, active: false },
            { filmId: 2, reviewerId: 3, completed: false, reviewDate: null, rating: null, description: null, active: false },
            { filmId: 4, reviewerId: 4, completed: true, reviewDate: '2026-05-01', rating: 4, description: 'Warm and precise.', active: false },
        ];

        this.nextFilmId = 5;
        this.imageService = options.imageService || new ImageService(options.imageOptions);
        this.requestIdentity = new AsyncLocalStorage();
        this.fallbackUserId = null;
        this.allowedImageMediaTypes = new Set(['image/png', 'image/jpg', 'image/jpeg', 'image/gif']);
        // Session-identity-safe presence: Map<sessionId, userId> is the source
        // of truth; Map<userId, Set<sessionId>> is a derived, kept-in-sync
        // per-user view (used for isUserOnline / webSocketSnapshot). Neither
        // map's keys are ever exposed over REST or WebSocket (see
        // webSocketStatusMessage / isUserOnline) — only userId is.
        this.userIdBySessionId = new Map();
        this.sessionIdsByUserId = new Map();
    }

    get currentUserId() {
        return this.requestIdentity.getStore()?.userId ?? this.fallbackUserId;
    }

    set currentUserId(userId) {
        this.fallbackUserId = userId == null ? null : Number(userId);
    }

    runAsUser(userId, callback) {
        return this.requestIdentity.run({ userId: userId == null ? null : Number(userId) }, callback);
    }

    requireUser() {
        if (!this.currentUserId) throw this.error('Authentication required.', 401);
        return this.currentUserId;
    }


    /*
TODO (Future Improvement)

Current implementation keeps error status codes inside the handwritten
business layer, which is already regeneration-safe because these files are
never overwritten.

A future improvement could introduce a shared ApiError catalog generated or
validated against the OpenAPI specification.

Possible goals:

- centralize reusable error definitions;
- validate runtime error status codes against OpenAPI;
- reduce duplicated status/message definitions;
- preserve regeneration safety.

Not implemented intentionally to keep the regeneration architecture simple and
focused.
*/
    error(message, status = 400) {
        const error = new Error(message);
        error.status = status;
        return error;
    }

    user(id) {
        const user = this.users.find((item) => item.id === Number(id));
        return user && { id: user.id, name: user.name, email: user.email, self: `/api/users/${user.id}` };
    }

    internalUser(id) {
        return this.users.find((item) => item.id === Number(id));
    }

    async verifyCredentials(email, password) {
        const user = this.users.find((candidate) => candidate.email === email);
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
        return user;
    }

    isUserOnline(userId) {
        const sessions = this.sessionIdsByUserId.get(Number(userId));
        return !!sessions && sessions.size > 0;
    }

    _addSession(userId, sessionId) {
        this.userIdBySessionId.set(sessionId, userId);
        let sessions = this.sessionIdsByUserId.get(userId);
        if (!sessions) {
            sessions = new Set();
            this.sessionIdsByUserId.set(userId, sessions);
        }
        sessions.add(sessionId);
    }

    _removeSession(userId, sessionId) {
        this.userIdBySessionId.delete(sessionId);
        const sessions = this.sessionIdsByUserId.get(userId);
        if (!sessions) return;
        sessions.delete(sessionId);
        if (sessions.size === 0) this.sessionIdsByUserId.delete(userId);
    }

    // sessionId must be the real, request-scoped session identity (Express's
    // request.sessionID — see adapters/openapi-generator/sessionAuth.js). A
    // failed login never reaches this method (sessionAuth.js only calls it
    // inside the passport.authenticate success handler), so a rejected login
    // never registers a session.
    //
    // previousSessionId (optional) is the session id the request *arrived
    // with*, captured before passport's login-time regeneration. Passport
    // regenerates the session (and its id) on every successful login as
    // session-fixation protection, so a client resubmitting a login while
    // already holding a session cookie tracked for this same user would
    // otherwise always look like an unrelated brand-new session. When
    // previousSessionId already maps to this userId, this call is treated as
    // a continuation of that existing session (the tracked id is swapped,
    // not duplicated) rather than a second live session.
    recordLogin(userId, sessionId, previousSessionId) {
        if (sessionId === undefined || sessionId === null) {
            throw new Error('recordLogin requires a real session id.');
        }
        const id = Number(userId);

        if (previousSessionId !== undefined && this.userIdBySessionId.get(previousSessionId) === id) {
            this._removeSession(id, previousSessionId);
            this._addSession(id, sessionId);
            return;
        }

        const wasOnline = this.isUserOnline(id);
        // _addSession is idempotent for an already-tracked sessionId (Set/Map
        // overwritten with the same value), so a repeated login using the
        // literal same session id is a no-op beyond this point.
        this._addSession(id, sessionId);
        if (!wasOnline) {
            const message = this.webSocketStatusMessage(id, 'login');
            if (message) this.emit('login', message);
        }
    }

    // Removes only the given session id. Logging out from a session id that
    // was never registered, or that belongs to a different user, is a
    // deliberate no-op — it must never remove a *different*, still-live
    // session for the same or another user.
    recordLogout(userId, sessionId) {
        const id = Number(userId);
        if (this.userIdBySessionId.get(sessionId) !== id) return;
        this._removeSession(id, sessionId);
        if (!this.isUserOnline(id)) {
            this.emit('logout', { typeMessage: 'logout', userId: id });
        }
    }

    film(id) {
        return this.films.find((item) => item.id === Number(id));
    }

    validateFilmInput(filmInput) {
        if (!filmInput || typeof filmInput !== 'object' || Array.isArray(filmInput)) {
            throw this.error('Film payload must be an object.', 400);
        }
        const allowed = new Set(['title', 'private', 'watchDate', 'rating', 'favorite']);
        if (Object.keys(filmInput).some((key) => !allowed.has(key))) {
            throw this.error('Film payload contains unknown properties.', 400);
        }
        if (typeof filmInput.title !== 'string' || filmInput.title.length === 0) {
            throw this.error('title is required.', 400);
        }
        if (typeof filmInput.private !== 'boolean') {
            throw this.error('private is required and must be boolean.', 400);
        }
        if (filmInput.watchDate != null && !isStrictCalendarDate(filmInput.watchDate)) {
            throw this.error('watchDate must be a valid YYYY-MM-DD calendar date.', 400);
        }
        if (filmInput.rating != null && (!Number.isInteger(filmInput.rating) || filmInput.rating < 0 || filmInput.rating > 10)) {
            throw this.error('rating must be an integer between 0 and 10.', 400);
        }
        if (filmInput.favorite != null && typeof filmInput.favorite !== 'boolean') {
            throw this.error('favorite must be boolean.', 400);
        }
        if (!filmInput.private && (filmInput.watchDate != null || filmInput.rating != null || filmInput.favorite != null)) {
            throw this.error('Public films cannot contain watchDate, rating, or favorite.', 400);
        }
    }

    filmDto(film, publicRoute = false) {
        if (!film) return undefined;
        const dto = {
            id: film.id,
            title: film.title,
            owner: film.ownerId,
            private: !film.public,
            self: publicRoute ? `/api/films/public/${film.id}` : `/api/films/${film.id}`,
        };
        if (film.public) dto.reviews = `/api/films/public/${film.id}/reviews`;
        if (!film.public) {
            if (film.watchDate != null) dto.watchDate = film.watchDate;
            if (film.rating != null) dto.rating = film.rating;
            dto.favorite = Boolean(film.favorite);
        }
        return dto;
    }

    page(items, path, collectionName, page = 1, limit = 10) {
        // EVALUATION-NOTE: Final API pagination must reject invalid page/limit values with 400.
        const pageNumber = Number(page);
        const pageLimit = Number(limit);
        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
            throw this.error('page must be a positive integer.', 400);
        }
        if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 100) {
            throw this.error('limit must be an integer between 1 and 100.', 400);
        }
        const totalItems = items.length;
        const totalPages = Math.ceil(totalItems / pageLimit);
        const start = (pageNumber - 1) * pageLimit;
        const separator = path.includes('?') ? '&' : '?';
        const pagePath = (targetPage) => `${path}${separator}page=${targetPage}&limit=${pageLimit}`;

        const result = {
            totalPages,
            currentPage: pageNumber,
            totalItems,
            [collectionName]: items.slice(start, start + pageLimit),
            self: pagePath(pageNumber),
        };
        if (pageNumber < totalPages) result.next = pagePath(pageNumber + 1);
        if (pageNumber > 1 && totalPages > 0) result.prev = pagePath(pageNumber - 1);
        return result;
    }

    reviewDto(review) {
        if (!review) return undefined;
        const dto = {
            filmId: review.filmId,
            reviewerId: review.reviewerId,
            completed: Boolean(review.completed),
            reviewer: this.user(review.reviewerId),
            self: `/api/films/public/${review.filmId}/reviews/${review.reviewerId}`,
        };
        if (review.active !== undefined) dto.active = Boolean(review.active);
        if (review.completed) {
            dto.reviewDate = review.reviewDate;
            dto.rating = review.rating;
            dto.review = review.description;
        }
        return dto;
    }

    canReadFilm(userId, film) {
        return Boolean(film && (film.public || film.ownerId === Number(userId)));
    }

    isReviewer(userId, filmId) {
        return this.reviews.some((review) => review.filmId === Number(filmId) && review.reviewerId === Number(userId));
    }

    healthGET() {
        return { status: 'ok' };
    }

    apiGET() {
        return {
            self: '/api',
            publicFilms: '/api/films/public',
            ownedFilms: '/api/films',
            invitedFilms: '/api/films/to-review',
            reviewAssignments: '/api/films/public/assignments',
            users: '/api/users',
            session: '/api/sessions/current',
        };
    }

    statusGET() {
        return this.healthGET();
    }

    // NOTE: this generated-interface login/logout pair is not on the real HTTP
    // path — adapters/openapi-generator/sessionAuth.js registers /api/sessions
    // directly on the Express app, before OpenApiValidator, so it shadows the
    // generated SessionsController for the same routes. There is no real
    // Express request/session available here, so a fixed per-user key is used
    // instead of a real session id; this reproduces the same idempotent-login/
    // guaranteed-logout behavior this dead path already had prior to real
    // session-id tracking, without fabricating a fake "real" session id.
    async sessionsPOST(loginRequest = {}) {
        const user = await this.verifyCredentials(loginRequest.email, loginRequest.password);
        if (!user) throw this.error('Invalid email or password.', 401);
        this.currentUserId = user.id;
        this.recordLogin(user.id, `sessionless:${user.id}`);
        return this.user(user.id);
    }

    sessionsCurrentGET() {
        this.requireUser();
        return this.user(this.currentUserId);
    }

    sessionsCurrentDELETE() {
        this.requireUser();
        this.recordLogout(this.currentUserId, `sessionless:${this.currentUserId}`);
        this.currentUserId = null;
        return null;
    }

    usersGET() {
        this.requireUser();
        return this.users.map((user) => this.user(user.id));
    }

    usersUserIdGET(userId) {
        this.requireUser();
        const user = this.user(userId);
        if (!user) throw this.error('User not found.', 404);
        return user;
    }

    usersOnlineGET() {
        this.requireUser();
        return this.users.filter((user) => this.isUserOnline(user.id)).map((user) => {
            const activeReview = this.reviews.find((review) => review.reviewerId === user.id && review.active);
            const activeFilm = activeReview && this.film(activeReview.filmId);
            return {
                userId: user.id,
                userName: user.name,
                filmId: activeFilm?.id || null,
                filmTitle: activeFilm?.title || null,
            };
        });
    }

    webSocketStatusMessage(userId, typeMessage = 'update') {
        const user = this.user(userId);
        if (!user) return null;
        if (typeMessage === 'logout') {
            return {
                typeMessage,
                userId: user.id,
            };
        }

        const activeReview = this.reviews.find((review) => review.reviewerId === user.id && review.active);
        const activeFilm = activeReview && this.film(activeReview.filmId);
        return {
            typeMessage,
            userId: user.id,
            userName: user.name,
            ...(activeFilm ? { filmId: activeFilm.id, filmTitle: activeFilm.title } : {}),
        };
    }

    // Guards against emitting a malformed 'update' event: webSocketStatusMessage
    // only returns null/undefined for a userId that doesn't resolve to a real
    // user, which should not happen for these authenticated call sites, but
    // this keeps a defensive boundary between service-level bugs and the
    // realtime transport layer's schema validation.
    emitUpdateFor(userId) {
        const message = this.webSocketStatusMessage(userId, 'update');
        if (message) this.emit('update', message);
    }

    webSocketSnapshot() {
        // Deterministic ordering (ascending numeric userId) so the initial
        // snapshot a newly-connected WebSocket client receives is stable and
        // testable, independent of Map insertion/session order.
        return [...this.sessionIdsByUserId.keys()]
            .sort((left, right) => left - right)
            .map((userId) => this.webSocketStatusMessage(userId, 'login'))
            .filter(Boolean);
    }

    mqttFilmMessage(filmId, deleted = false) {
        if (deleted) return { status: 'deleted' };

        const activeReview = this.reviews.find((review) => review.filmId === Number(filmId) && review.active);
        if (!activeReview) return { status: 'inactive' };

        const user = this.user(activeReview.reviewerId);
        return {
            status: 'active',
            userId: user.id,
            userName: user.name,
        };
    }

    mqttInitialFilmMessages() {
        return this.films
            .filter((film) => film.public)
            .map((film) => ({
                filmId: film.id,
                message: this.mqttFilmMessage(film.id),
            }));
    }

    filmsPublicGET(page, limit) {
        const films = this.films
            .filter((film) => film.public)
            .sort((left, right) => left.id - right.id)
            .map((film) => this.filmDto(film, true));
        return this.page(films, '/api/films/public', 'films', page, limit);
    }

    filmsPublicFilmIdGET(filmId) {
        const film = this.film(filmId);
        if (!film?.public) throw this.error('Public film not found.', 404);
        return this.filmDto(film, true);
    }

    filmsPublicFilmIdReviewsGET(filmId, page, limit) {
        this.filmsPublicFilmIdGET(filmId);
        const reviews = this.reviews.filter((review) => review.filmId === Number(filmId)).map((review) => this.reviewDto(review));
        return this.page(reviews, `/api/films/public/${filmId}/reviews`, 'reviews', page, limit);
    }

    filmsPublicFilmIdReviewsReviewerIdGET(filmId, reviewerId) {
        this.filmsPublicFilmIdGET(filmId);
        const review = this.reviews.find((item) => item.filmId === Number(filmId) && item.reviewerId === Number(reviewerId));
        if (!review) throw this.error('Review not found.', 404);
        return this.reviewDto(review);
    }

    filmsGET(page, limit) {
        const userId = this.requireUser();
        const films = this.films
            .filter((film) => !film.public && film.ownerId === userId)
            .map((film) => this.filmDto(film));
        return this.page(films, '/api/films', 'films', page, limit);
    }

    getFilms() {
        return this.filmsGET();
    }

    filmsPOST(filmInput = {}) {
        const userId = this.requireUser();
        this.validateFilmInput(filmInput);
        const isPublic = !filmInput.private;
        const film = {
            id: this.nextFilmId,
            title: filmInput.title,
            ownerId: userId,
            public: isPublic,
            watchDate: filmInput.watchDate || null,
            rating: filmInput.rating ?? null,
            favorite: Boolean(filmInput.favorite),
        };
        this.nextFilmId += 1;
        this.films.push(film);
        const dto = this.filmDto(film);
        if (film.public) dto.mqtt = this.mqttFilmMessage(film.id);
        return dto;
    }

    createFilm(filmInput) {
        return this.filmsPOST(filmInput);
    }

    filmsToReviewGET(page, limit) {
        const userId = this.requireUser();
        const filmIds = new Set(
            this.reviews.filter((review) => review.reviewerId === userId).map((review) => review.filmId),
        );
        const films = this.films.filter((film) => film.public && filmIds.has(film.id)).map((film) => this.filmDto(film, true));
        return this.page(films, '/api/films/to-review', 'films', page, limit);
    }

    reviewsAutoInvitationsPOST() {
        const userId = this.requireUser();
        const created = [];
        // Balance the assignments created by this invocation. Historical invitation totals
        // must not skew a new batch, whose maximum/minimum reviewer counts may differ by at most 1.
        const invitationCounts = new Map(this.users.map((user) => [user.id, 0]));

        this.films
            .filter((film) => film.public && film.ownerId === userId)
            .filter((film) => !this.reviews.some((review) => review.filmId === film.id))
            .forEach((film) => {
                const reviewer = [...this.users].sort((left, right) => (
                    invitationCounts.get(left.id) - invitationCounts.get(right.id) || left.id - right.id
                ))[0];
                const review = {
                    filmId: film.id,
                    reviewerId: reviewer.id,
                    completed: false,
                    reviewDate: null,
                    rating: null,
                    description: null,
                    active: false,
                };
                this.reviews.push(review);
                invitationCounts.set(reviewer.id, invitationCounts.get(reviewer.id) + 1);
                created.push(this.reviewDto(review));
            });

        return created;
    }

    filmsFilmIdGET(filmId) {
        const userId = this.requireUser();
        const film = this.film(filmId);
        if (!film || film.public || film.ownerId !== userId) throw this.error('Private film not found.', 404);
        return this.filmDto(film);
    }

    filmsIdGET(id) {
        return this.filmsFilmIdGET(id);
    }

    getFilmById(id) {
        return this.filmsFilmIdGET(id);
    }

    filmsFilmIdPUT(filmId, filmInput = {}) {
        const userId = this.requireUser();
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (film.ownerId !== userId) throw this.error('Only the owner can update this film.', 403);
        this.validateFilmInput(filmInput);
        const requestedPublic = filmInput.private !== undefined ? !filmInput.private : filmInput.public;
        if (requestedPublic !== undefined && Boolean(requestedPublic) !== film.public) {
            throw this.error('Film visibility cannot be changed.', 409);
        }
        Object.assign(film, {
            title: filmInput.title ?? film.title,
            watchDate: filmInput.watchDate ?? film.watchDate,
            rating: filmInput.rating ?? film.rating,
            favorite: filmInput.favorite ?? film.favorite,
        });
        return null;
    }

    filmsFilmIdDELETE(filmId) {
        const userId = this.requireUser();
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (film.ownerId !== userId) throw this.error('Only the owner can delete this film.', 403);
        const deletedWasPublic = film.public;
        // Deleting the film removes every review for it, silently clearing any
        // reviewer's active-film state. Capture who was affected before the
        // reviews disappear, so already-connected WebSocket clients are told
        // about the now-cleared state instead of being left with stale data.
        const affectedReviewerIds = this.reviews
            .filter((review) => review.filmId === film.id && review.active)
            .map((review) => review.reviewerId);
        this.imageService.deleteByFilm(film.id);
        this.films = this.films.filter((item) => item.id !== film.id);
        this.reviews = this.reviews.filter((review) => review.filmId !== film.id);
        affectedReviewerIds.forEach((reviewerId) => {
            this.emitUpdateFor(reviewerId);
        });
        if (deletedWasPublic) return { mqtt: this.mqttFilmMessage(film.id, true) };
        return true;
    }

    filmsIdDELETE(id) {
        return this.filmsFilmIdDELETE(id);
    }

    deleteFilm(id) {
        return this.filmsFilmIdDELETE(id);
    }

    filmsFilmIdReviewsPOST(filmId, body = {}) {
        const userId = this.requireUser();
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (!film.public) throw this.error('Only public films can receive review invitations.', 409);
        if (film.ownerId !== userId) throw this.error('Only the owner can invite reviewers.', 403);
        const invitations = Array.isArray(body) ? body : [body];
        if (invitations.length === 0) throw this.error('At least one invitation is required.', 400);
        invitations.forEach((invitation) => {
            if (invitation.filmId != null && Number(invitation.filmId) !== film.id) {
                throw this.error('Invitation filmId must match the route filmId.', 400);
            }
            if (!this.user(invitation.reviewerId)) throw this.error('Reviewer does not exist.', 404);
            if (this.reviews.some((item) => item.filmId === film.id && item.reviewerId === Number(invitation.reviewerId))) {
                throw this.error('Review invitation already exists.', 409);
            }
        });
        const created = invitations.map((invitation) => {
            const review = { filmId: film.id, reviewerId: Number(invitation.reviewerId), completed: false, reviewDate: null, rating: null, description: null, active: false };
            this.reviews.push(review);
            return this.reviewDto(review);
        });
        return created;
    }

    filmsFilmIdReviewsReviewerIdDELETE(filmId, reviewerId) {
        const userId = this.requireUser();
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (film.ownerId !== userId) throw this.error('Only the owner can remove invitations.', 403);
        const review = this.reviews.find((item) => item.filmId === Number(filmId) && item.reviewerId === Number(reviewerId));
        if (!review) throw this.error('Invitation not found.', 404);
        if (review.completed) throw this.error('Completed reviews cannot be removed.', 409);
        const wasActive = review.active;
        this.reviews = this.reviews.filter((item) => item !== review);
        // Removing an active invitation silently clears that reviewer's active
        // film; tell already-connected clients so they never hold stale state.
        if (wasActive) this.emitUpdateFor(review.reviewerId);
        return true;
    }

    filmsFilmIdReviewsCurrentPUT(filmId, body = {}) {
        const userId = this.requireUser();
        const review = this.reviews.find((item) => item.filmId === Number(filmId) && item.reviewerId === userId);
        if (!review) {
            const filmHasInvitations = this.reviews.some((item) => item.filmId === Number(filmId));
            if (filmHasInvitations) throw this.error('Only the invited reviewer can complete this review.', 403);
            throw this.error('Review invitation not found.', 404);
        }
        const allowed = new Set(['completed', 'reviewDate', 'rating', 'review']);
        if (!body || typeof body !== 'object' || Array.isArray(body)
            || Object.keys(body).some((key) => !allowed.has(key))
            || body.completed !== true || !body.reviewDate || body.rating == null || !body.review) {
            throw this.error('completed, reviewDate, rating, and review are required.', 400);
        }
        if (!isStrictCalendarDate(body.reviewDate)) {
            throw this.error('reviewDate must be a valid YYYY-MM-DD calendar date.', 400);
        }
        if (!Number.isInteger(body.rating) || body.rating < 0 || body.rating > 10) {
            throw this.error('rating must be an integer between 0 and 10.', 400);
        }
        if (typeof body.review !== 'string' || body.review.length > 1000) {
            throw this.error('review must be a string of at most 1000 characters.', 400);
        }
        review.completed = true;
        review.reviewDate = body.reviewDate;
        review.rating = body.rating;
        review.description = body.review;
        return null;
    }

    filmsFilmIdActivePUT(filmId) {
        const userId = this.requireUser();
        const film = this.film(filmId);
        if (!film?.public) throw this.error('Public film not found.', 404);
        if (!this.isReviewer(userId, film.id)) throw this.error('The user is not a reviewer for this film.', 403);
        // Lab04 only requires "at most one active film per user". A film being
        // already active for a *different* reviewer is not a conflict: two
        // reviewers may independently have the same film active at once.
        const changedFilmIds = new Set();
        this.reviews.forEach((review) => {
            if (review.reviewerId === userId && review.active) {
                review.active = false;
                changedFilmIds.add(review.filmId);
            }
        });
        const review = this.reviews.find((item) => item.filmId === film.id && item.reviewerId === userId);
        review.active = true;
        changedFilmIds.add(film.id);
        const dto = this.reviewDto(review);
        dto.mqtt = [...changedFilmIds].map((changedFilmId) => ({
            filmId: changedFilmId,
            message: this.mqttFilmMessage(changedFilmId),
        }));
        // Emitted only after the mutation above has fully committed, so a
        // WebSocket client can never observe an update that was not actually
        // applied to the domain state.
        this.emitUpdateFor(userId);
        return dto;
    }

    usersCurrentActiveFilmDELETE() {
        const userId = this.requireUser();
        const changedFilmIds = new Set();
        this.reviews.forEach((review) => {
            if (review.reviewerId === userId && review.active) {
                review.active = false;
                changedFilmIds.add(review.filmId);
            }
        });
        this.emitUpdateFor(userId);
        return {
            mqtt: [...changedFilmIds].map((filmId) => ({
                filmId,
                message: this.mqttFilmMessage(filmId),
            })),
        };
    }

    filmsFilmIdImagesGET(filmId) {
        const userId = this.requireUser();
        return this.imageService.list(filmId, userId, this.film.bind(this), this.isReviewer.bind(this));
    }

    filmsFilmIdImagesPOST(filmId, imageInput = {}) {
        if (!this.currentUserId) {
            this.imageService.storage.discardUpload(imageInput);
            throw this.error('Authentication required.', 401);
        }
        const userId = this.currentUserId;
        return this.imageService.upload(filmId, userId, imageInput, this.film.bind(this));
    }

    filmsFilmIdImagesImageIdGET(filmId, imageId, accept = 'application/json') {
        const userId = this.requireUser();
        const { negotiateAccept } = require('../http/AcceptNegotiation');
        const requestedType = negotiateAccept(accept);
        if (!requestedType) throw this.error('No acceptable image representation is supported.', 406);
        return this.imageService.get(
            filmId,
            imageId,
            userId,
            requestedType,
            this.film.bind(this),
            this.isReviewer.bind(this),
        );
    }

    filmsFilmIdImagesImageIdDELETE(filmId, imageId) {
        const userId = this.requireUser();
        return this.imageService.delete(filmId, imageId, userId, this.film.bind(this));
    }
}

const filmManagerService = new FilmManagerService();
module.exports = filmManagerService;
module.exports.FilmManagerService = FilmManagerService;
