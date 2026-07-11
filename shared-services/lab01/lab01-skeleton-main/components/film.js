class Film{    
    constructor(id, title, owner, privateFilm, watchDate, rating, favorite) {
        if(id)
            this.id = id;

        this.title = title;
        this.owner = owner;
        this.private = privateFilm;

        if(watchDate)
            this.watchDate = watchDate;
        if(rating)
            this.rating = rating;
        if(favorite)
            this.favorite = favorite;
    
        this.self =  "/change/me"
    }
}

module.exports = Film;


