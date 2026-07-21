import { useEffect, useState } from 'react';
import API from '../api';

// Lets an authenticated reviewer select one of their assigned public films as
// active. The REST call is the only source of truth for the mutation; the
// resulting WebSocket 'update' broadcast is what actually refreshes the
// Online page / sidebar for every connected client (including this one).
export default function FilmsToReviewPage() {
    const [films, setFilms] = useState([]);
    const [error, setError] = useState('');
    const [pendingFilmId, setPendingFilmId] = useState(null);

    async function reload() {
        try {
            const page = await API.filmsToReview();
            setFilms(page.films || []);
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        reload();
    }, []);

    async function handleSelect(filmId) {
        setError('');
        setPendingFilmId(filmId);
        try {
            await API.selectActiveFilm(filmId);
            await reload();
        } catch (err) {
            setError(err.message);
        } finally {
            setPendingFilmId(null);
        }
    }

    return (
        <section className="films-to-review">
            <h2>Films to review</h2>
            {error && <p className="error" role="alert">{error}</p>}
            <ul>
                {films.map((film) => (
                    <li key={film.id}>
                        {film.title}
                        <button
                            type="button"
                            disabled={pendingFilmId === film.id}
                            onClick={() => handleSelect(film.id)}
                        >
                            Select as active
                        </button>
                    </li>
                ))}
                {films.length === 0 && <li className="empty">No films assigned for review.</li>}
            </ul>
        </section>
    );
}
