class User{    
    constructor(id, name, email, hash) {
        if(id)
            this.id = id;

        this.name = name;
        this.email = email;
        
        if(hash)
            this.hash = hash;

        this.self =  "/change/me";
    }
}

module.exports = User;
