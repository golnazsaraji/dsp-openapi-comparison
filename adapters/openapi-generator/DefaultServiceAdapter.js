const FilmService = require('../../shared-services/src/services/FilmService');

const filmsGET = async () => {
    return FilmService.getFilms();
};

const filmsIdGET = async ({ id }) => {
    return FilmService.getFilmById(id);
};

const filmsPOST = async ({ newFilm }) => {
    return FilmService.createFilm(newFilm);
};

const filmsIdDELETE = async ({ id }) => {
    return FilmService.deleteFilm(id);
};

const statusGET = async () => {
    return {
        status: 'ok',
    };
};

module.exports = {
    filmsGET,
    filmsIdGET,
    filmsPOST,
    filmsIdDELETE,
    statusGET,
};