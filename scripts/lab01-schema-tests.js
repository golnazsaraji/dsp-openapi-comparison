const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);

function schema(name) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'specifications', 'lab01', 'schemas', `${name}.schema.json`)));
}

function expect(validate, value, valid, label) {
    const actual = validate(value);
    if (actual !== valid) throw new Error(`${label}: ${ajv.errorsText(validate.errors)}`);
}

const film = ajv.compile(schema('film'));
expect(film, { id: 1, title: 'Public', owner: 1, private: false }, true, 'minimal public film');
expect(film, { id: 1, title: 'Public', owner: 1, private: false, favorite: false }, false, 'public conditional fields');
expect(film, { id: 2, title: 'Private', owner: 1, private: true, rating: 0, favorite: false }, true, 'private rating lower bound');
expect(film, { id: 2, title: 'Private', owner: 1, private: true, watchDate: '2026-07-11', rating: 10, favorite: true }, true, 'private conditional fields and rating upper bound');
expect(film, { id: 1, title: 'Public', owner: 1, private: false, watchDate: '2026-07-11' }, false, 'public watchDate');
expect(film, { id: 1, title: 'Public', owner: 1, private: false, rating: 0 }, false, 'public rating');
expect(film, { id: 2, title: 'Private', owner: 1, private: true, rating: -1 }, false, 'film rating below lower bound');
expect(film, { id: 2, title: 'Private', owner: 1, private: true, rating: 11 }, false, 'film rating upper bound');

const review = ajv.compile(schema('review'));
expect(review, { filmId: 1, reviewerId: 2, completed: false }, true, 'incomplete review');
expect(review, { filmId: 1, reviewerId: 2, completed: false, rating: 5 }, false, 'incomplete review fields');
expect(review, { filmId: 1, reviewerId: 2, completed: true, reviewDate: '2026-07-11', rating: 0, review: 'Clear.' }, true, 'completed review');
expect(review, { filmId: 1, reviewerId: 2, completed: true, rating: 5, review: 'Missing date' }, false, 'completed review date required');
expect(review, { filmId: 1, reviewerId: 2, completed: true, reviewDate: '2026-07-11', review: 'Missing rating' }, false, 'completed review rating required');
expect(review, { filmId: 1, reviewerId: 2, completed: true, reviewDate: '2026-07-11', rating: 5 }, false, 'completed review text required');
expect(review, { filmId: 1, reviewerId: 2, completed: true, reviewDate: '2026-07-11', rating: 5, review: 'x'.repeat(1001) }, false, 'review text upper bound');

const user = ajv.compile(schema('user'));
expect(user, { id: 1, email: 'alice@example.com' }, true, 'minimal user');
expect(user, { id: 1, email: 'invalid' }, false, 'email format');
expect(user, { id: 1, email: 'alice@example.com', password: 'short' }, false, 'password lower bound');
expect(user, { id: 1, email: 'alice@example.com', password: 'x'.repeat(21) }, false, 'password upper bound');

console.log('Lab01 Draft 7 schema tests passed.');
