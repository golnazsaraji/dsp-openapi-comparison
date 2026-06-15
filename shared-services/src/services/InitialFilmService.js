class InitialFilmService {
    constructor() {
        // EVALUATION-NOTE: Handwritten service for the initial simple OpenAPI example.
        this.films = [
            { id: 1, title: 'Interstellar' },
            { id: 2, title: 'The Matrix' },
        ];
        this.nextFilmId = 3;
    }

    error(message, status = 400) {
        const error = new Error(message);
        error.status = status;
        return error;
    }

    statusGET() {
        return { status: 'ok' };
    }

    filmsGET() {
        return this.films;
    }

    filmsIdGET(id) {
        const film = this.films.find((item) => item.id === Number(id));
        if (!film) throw this.error('Film not found.', 404);
        return film;
    }

    filmsPOST(newFilm = {}) {
        // EVALUATION-NOTE: Keeps initial example validation explicit for POST /films.
        if (!newFilm.title) throw this.error('title is required.', 400);
        const film = {
            id: this.nextFilmId,
            title: newFilm.title,
        };
        this.nextFilmId += 1;
        this.films.push(film);
        return film;
    }

    filmsIdDELETE(id) {
        const film = this.filmsIdGET(id);
        this.films = this.films.filter((item) => item.id !== film.id);
        return true;
    }
}

module.exports = new InitialFilmService();
