class FilmService {
    constructor() {
        this.films = [
            {
                id: 1,
                title: 'Interstellar',
            },
        ];

        this.nextId = 2;
    }

    async getFilms() {
        return this.films;
    }

    async getFilmById(id) {
        const numericId = Number(id);
        return this.films.find((film) => film.id === numericId) || null;
    }

    async createFilm(newFilm) {
        const film = {
            id: this.nextId,
            title: newFilm.title,
        };

        this.films.push(film);
        this.nextId += 1;

        return film;
    }

    async deleteFilm(id) {
        const numericId = Number(id);
        const initialLength = this.films.length;

        this.films = this.films.filter((film) => film.id !== numericId);

        return this.films.length < initialLength;
    }
}

module.exports = new FilmService();