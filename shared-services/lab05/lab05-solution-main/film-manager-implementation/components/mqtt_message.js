class MQTTMessage {    
    constructor(status, userId, userName) {

        this.status = status;
        if(userId) this.userId = userId;
        if(userName) this.userName = userName;

    }
}

module.exports = MQTTMessage;