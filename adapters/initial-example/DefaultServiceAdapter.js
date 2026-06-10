const InitialFilmService = require('../../shared-services/src/services/InitialFilmService');

module.exports = {
    statusGET() {
        return InitialFilmService.statusGET();
    },

    filmsGET() {
        return InitialFilmService.filmsGET();
    },

    filmsIdGET(id) {
        return InitialFilmService.filmsIdGET(id);
    },

    filmsPOST(newFilm) {
        return InitialFilmService.filmsPOST(newFilm);
    },

    filmsIdDELETE(id) {
        return InitialFilmService.filmsIdDELETE(id);
    },
};
