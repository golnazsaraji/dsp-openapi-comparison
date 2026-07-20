'use strict';

const sqlite = require('sqlite3').verbose();
const path = require('path');

const DBSOURCE = path.join(__dirname, '../database/databaseV2.db');

const db = new sqlite.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.log('Could not connect to database', err);
        console.error(err.message);
        throw err;
    }
    console.log('Connected to the SQLite database (' + DBSOURCE + ').');
    db.exec('PRAGMA foreign_keys = ON;', function(error)  {
        if (error){
            console.error("Pragma statement didn't work.")
        }
    });
});

module.exports = db;
