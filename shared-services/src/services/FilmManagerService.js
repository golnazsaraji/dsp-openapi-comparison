class FilmManagerService {
    constructor() {
        this.users = [
            { id: 1, name: 'Alice', email: 'alice@example.com', password: 'password' },
            { id: 2, name: 'Frank', email: 'frank@example.com', password: 'password' },
            { id: 3, name: 'Karen', email: 'karen@example.com', password: 'password' },
            { id: 4, name: 'Rene', email: 'rene@example.com', password: 'password' },
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

        this.images = [];
        this.nextFilmId = 5;
        this.nextImageId = 1;
        this.currentUserId = 1;
        this.allowedImageMediaTypes = new Set(['image/png', 'image/jpg', 'image/jpeg', 'image/gif']);
        this.loggedInUserIds = new Set();
    }

    error(message, status = 400) {
        const error = new Error(message);
        error.status = status;
        return error;
    }

    user(id) {
        const user = this.users.find((item) => item.id === Number(id));
        return user && { id: user.id, name: user.name, email: user.email, self: `/api/users/${user.id}` };
    }

    film(id) {
        return this.films.find((item) => item.id === Number(id));
    }

    filmDto(film, publicRoute = false) {
        return film && {
            ...film,
            owner: film.ownerId,
            private: !film.public,
            self: publicRoute ? `/api/films/public/${film.id}` : `/api/films/${film.id}`,
        };
    }

    page(items, path, page = 1, limit = 10) {
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

        return {
            items: items.slice(start, start + pageLimit),
            pagination: {
                page: pageNumber,
                limit: pageLimit,
                totalItems,
                totalPages,
            },
            self: pagePath(pageNumber),
            next: pageNumber < totalPages ? pagePath(pageNumber + 1) : null,
            prev: pageNumber > 1 && totalPages > 0 ? pagePath(pageNumber - 1) : null,
        };
    }

    reviewDto(review) {
        return review && {
            ...review,
            review: review.description,
            reviewer: this.user(review.reviewerId),
            self: `/api/films/public/${review.filmId}/reviews/${review.reviewerId}`,
        };
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

    statusGET() {
        return this.healthGET();
    }

    sessionsPOST(loginRequest = {}) {
        const user = this.users.find((candidate) => (
            candidate.email === loginRequest.email && candidate.password === loginRequest.password
        ));
        if (!user) throw this.error('Invalid email or password.', 401);
        this.currentUserId = user.id;
        this.loggedInUserIds.add(user.id);
        return this.user(user.id);
    }

    sessionsCurrentGET() {
        return this.user(this.currentUserId);
    }

    sessionsCurrentDELETE() {
        this.loggedInUserIds.delete(this.currentUserId);
        return null;
    }

    usersOnlineGET() {
        return this.users.filter((user) => this.loggedInUserIds.has(user.id)).map((user) => {
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

    webSocketSnapshot() {
        return [...this.loggedInUserIds]
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
        const films = this.films.filter((film) => film.public).map((film) => this.filmDto(film, true));
        return this.page(films, '/api/films/public', page, limit);
    }

    filmsPublicFilmIdGET(filmId) {
        const film = this.film(filmId);
        if (!film?.public) throw this.error('Public film not found.', 404);
        return this.filmDto(film, true);
    }

    filmsPublicFilmIdReviewsGET(filmId, page, limit) {
        this.filmsPublicFilmIdGET(filmId);
        const reviews = this.reviews.filter((review) => review.filmId === Number(filmId)).map((review) => this.reviewDto(review));
        return this.page(reviews, `/api/films/public/${filmId}/reviews`, page, limit);
    }

    filmsPublicFilmIdReviewsReviewerIdGET(filmId, reviewerId) {
        this.filmsPublicFilmIdGET(filmId);
        const review = this.reviews.find((item) => item.filmId === Number(filmId) && item.reviewerId === Number(reviewerId));
        if (!review) throw this.error('Review not found.', 404);
        return this.reviewDto(review);
    }

    filmsGET(page, limit) {
        const films = this.films.filter((film) => film.ownerId === this.currentUserId).map((film) => this.filmDto(film));
        return this.page(films, '/api/films', page, limit);
    }

    getFilms() {
        return this.filmsGET();
    }

    filmsPOST(filmInput = {}) {
        if (!filmInput.title) throw this.error('title is required');
        const isPublic = filmInput.private !== undefined ? !filmInput.private : Boolean(filmInput.public);
        const film = {
            id: this.nextFilmId,
            title: filmInput.title,
            ownerId: this.currentUserId,
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
        const filmIds = new Set(
            this.reviews.filter((review) => review.reviewerId === this.currentUserId).map((review) => review.filmId),
        );
        const films = this.films.filter((film) => filmIds.has(film.id)).map((film) => this.filmDto(film));
        return this.page(films, '/api/films/to-review', page, limit);
    }

    reviewsAutoInvitationsPOST() {
        const created = [];
        const invitationCounts = new Map(this.users.map((user) => [
            user.id,
            this.reviews.filter((review) => review.reviewerId === user.id).length,
        ]));

        this.films
            .filter((film) => film.public)
            .filter((film) => !this.reviews.some((review) => review.filmId === film.id))
            .forEach((film) => {
                const reviewer = [...this.users].sort((left, right) => (
                    invitationCounts.get(left.id) - invitationCounts.get(right.id)
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

        if (created.length === 0) throw this.error('No public films without invitations.', 409);
        return {
            items: created,
            self: '/api/reviews/auto-invitations',
        };
    }

    filmsFilmIdGET(filmId) {
        const film = this.film(filmId);
        if (!this.canReadFilm(this.currentUserId, film)) throw this.error('Film not found.', 404);
        return this.filmDto(film);
    }

    filmsIdGET(id) {
        return this.filmsFilmIdGET(id);
    }

    getFilmById(id) {
        return this.filmsFilmIdGET(id);
    }

    filmsFilmIdPUT(filmId, filmInput = {}) {
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (film.ownerId !== this.currentUserId) throw this.error('Only the owner can update this film.', 403);
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
        return this.filmDto(film);
    }

    filmsFilmIdDELETE(filmId) {
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (film.ownerId !== this.currentUserId) throw this.error('Only the owner can delete this film.', 403);
        const deletedWasPublic = film.public;
        this.films = this.films.filter((item) => item.id !== film.id);
        this.reviews = this.reviews.filter((review) => review.filmId !== film.id);
        this.images = this.images.filter((image) => image.filmId !== film.id);
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
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (!film.public) throw this.error('Only public films can receive review invitations.', 409);
        if (film.ownerId !== this.currentUserId) throw this.error('Only the owner can invite reviewers.', 403);
        if (!this.user(body.reviewerId)) throw this.error('Reviewer does not exist.', 404);
        let review = this.reviews.find((item) => item.filmId === film.id && item.reviewerId === Number(body.reviewerId));
        if (!review) {
            review = { filmId: film.id, reviewerId: Number(body.reviewerId), completed: false, reviewDate: null, rating: null, description: null, active: false };
            this.reviews.push(review);
        }
        return this.reviewDto(review);
    }

    filmsFilmIdReviewsReviewerIdDELETE(filmId, reviewerId) {
        const review = this.reviews.find((item) => item.filmId === Number(filmId) && item.reviewerId === Number(reviewerId));
        if (!review) throw this.error('Invitation not found.', 404);
        if (review.completed) throw this.error('Completed reviews cannot be removed.', 409);
        this.reviews = this.reviews.filter((item) => item !== review);
        return true;
    }

    filmsFilmIdReviewsCurrentPUT(filmId, body = {}) {
        const review = this.reviews.find((item) => item.filmId === Number(filmId) && item.reviewerId === this.currentUserId);
        if (!review) throw this.error('Review invitation not found.', 404);
        review.completed = true;
        review.reviewDate = body.reviewDate || new Date().toISOString().slice(0, 10);
        review.rating = body.rating ?? review.rating;
        review.description = body.review ?? body.description ?? review.description;
        return this.reviewDto(review);
    }

    filmsFilmIdActivePUT(filmId) {
        const film = this.film(filmId);
        if (!film?.public) throw this.error('Public film not found.', 404);
        if (!this.isReviewer(this.currentUserId, film.id)) throw this.error('The user is not a reviewer for this film.', 403);
        const conflicting = this.reviews.find((review) => (
            review.filmId === film.id && review.active && review.reviewerId !== this.currentUserId
        ));
        if (conflicting) throw this.error('The film is already active for another user.', 409);
        const changedFilmIds = new Set();
        this.reviews.forEach((review) => {
            if (review.reviewerId === this.currentUserId && review.active) {
                review.active = false;
                changedFilmIds.add(review.filmId);
            }
        });
        const review = this.reviews.find((item) => item.filmId === film.id && item.reviewerId === this.currentUserId);
        review.active = true;
        changedFilmIds.add(film.id);
        const dto = this.reviewDto(review);
        dto.mqtt = [...changedFilmIds].map((changedFilmId) => ({
            filmId: changedFilmId,
            message: this.mqttFilmMessage(changedFilmId),
        }));
        return dto;
    }

    usersCurrentActiveFilmDELETE() {
        const changedFilmIds = new Set();
        this.reviews.forEach((review) => {
            if (review.reviewerId === this.currentUserId && review.active) {
                review.active = false;
                changedFilmIds.add(review.filmId);
            }
        });
        return {
            mqtt: [...changedFilmIds].map((filmId) => ({
                filmId,
                message: this.mqttFilmMessage(filmId),
            })),
        };
    }

    imageMediaType(fileName = '') {
        const lowerName = String(fileName).toLowerCase();
        if (lowerName.endsWith('.png')) return 'image/png';
        if (lowerName.endsWith('.jpg')) return 'image/jpg';
        if (lowerName.endsWith('.jpeg')) return 'image/jpeg';
        if (lowerName.endsWith('.gif')) return 'image/gif';
        return null;
    }

    filmsFilmIdImagesGET(filmId) {
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (!this.canReadFilm(this.currentUserId, film)) throw this.error('Image access denied.', 403);
        return this.images.filter((image) => image.filmId === Number(filmId));
    }

    filmsFilmIdImagesPOST(filmId, imageInput = {}) {
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (!film.public || film.ownerId !== this.currentUserId) {
            throw this.error('Only the owner can add images to a public film.', 403);
        }
        const uploadedName = typeof imageInput === 'string' ? imageInput : imageInput.name;
        const mediaType = imageInput.mediaType || this.imageMediaType(uploadedName) || 'image/png';
        if (!this.allowedImageMediaTypes.has(mediaType)) {
            throw this.error('Unsupported image media type.', 415);
        }
        const image = {
            id: this.nextImageId,
            filmId: Number(filmId),
            name: uploadedName || `image-${this.nextImageId}`,
            mediaType,
            self: `/api/films/${filmId}/images/${this.nextImageId}`,
        };
        this.nextImageId += 1;
        this.images.push(image);
        return image;
    }

    filmsFilmIdImagesImageIdGET(filmId, imageId, accept = 'application/json') {
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (!this.canReadFilm(this.currentUserId, film)) throw this.error('Image access denied.', 403);
        const image = this.images.find((item) => item.filmId === Number(filmId) && item.id === Number(imageId));
        if (!image) throw this.error('Image not found.', 404);
        const acceptedTypes = String(accept || 'application/json').split(',').map((item) => item.split(';')[0].trim());
        const requestedType = acceptedTypes.find((item) => item === '*/*' || item === 'application/json' || this.allowedImageMediaTypes.has(item));
        if (!requestedType) throw this.error('Unsupported requested image media type.', 406);
        return image;
    }

    filmsFilmIdImagesImageIdDELETE(filmId, imageId) {
        const film = this.film(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (film.ownerId !== this.currentUserId) throw this.error('Only the owner can delete images from this film.', 403);
        const image = this.images.find((item) => item.filmId === Number(filmId) && item.id === Number(imageId));
        if (!image) throw this.error('Image not found.', 404);
        this.images = this.images.filter((item) => item !== image);
        return true;
    }
}

module.exports = new FilmManagerService();
