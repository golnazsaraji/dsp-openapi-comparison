import { useEffect, useState } from 'react';
import API from '../api';
import { useFilmSelectionMqtt } from '../mqtt/useFilmSelectionMqtt';
import { removeDeletedFilms } from '../mqtt/filmSelectionReducer';
import { describeSelectionError, canStartSelection } from '../mqtt/describeSelectionError';

// Lets an authenticated reviewer select one of their assigned public films as
// active. The REST call is the only source of truth for the mutation (a
// "pending confirmation" UX: a film is never shown as selected until the
// request actually succeeds); the resulting WebSocket 'update' broadcast is
// what refreshes the Online page / sidebar. Live per-film status (who else
// has a film active right now, and deletions) instead comes from Lab05 MQTT,
// independently of the REST call — a transport failure on either side never
// rolls back the other.
export default function FilmsToReviewPage({ currentUser }) {
    const [films, setFilms] = useState([]);
    const [error, setError] = useState('');
    const [pendingFilmId, setPendingFilmId] = useState(null);
    const filmStatusByFilmId = useFilmSelectionMqtt(films.map((film) => film.id));

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

    // A film reported 'deleted' over MQTT is dropped from `films` itself
    // (not just filtered out of what's rendered), rather than waiting for
    // the next full reload of /api/films/to-review. Dropping it here also
    // shrinks the id set passed to useFilmSelectionMqtt below, so its
    // subscription-diffing (see connectFilmSelectionMqtt.js) unsubscribes
    // the now-irrelevant topic automatically.
    useEffect(() => {
        setFilms((current) => removeDeletedFilms(current, filmStatusByFilmId));
    }, [filmStatusByFilmId]);

    async function handleSelect(filmId) {
        if (!canStartSelection(pendingFilmId)) return; // guard against duplicate in-flight selections
        setError('');
        setPendingFilmId(filmId);
        try {
            await API.selectActiveFilm(filmId);
            await reload();
        } catch (err) {
            setError(describeSelectionError(err));
        } finally {
            setPendingFilmId(null);
        }
    }

    return (
        <section className="films-to-review">
            <h2>Films to review</h2>
            {error && <p className="error" role="alert">{error}</p>}
            <ul>
                {films.map((film) => {
                    const liveStatus = filmStatusByFilmId[film.id];
                    return (
                        <li key={film.id}>
                            {film.title}
                            {liveStatus?.status === 'active' && (
                                <span className="active-badge">
                                    {liveStatus.userId === currentUser?.id ? ' (active for you)' : ` (active for ${liveStatus.userName})`}
                                </span>
                            )}
                            <button
                                type="button"
                                disabled={pendingFilmId === film.id}
                                onClick={() => handleSelect(film.id)}
                            >
                                Select as active
                            </button>
                        </li>
                    );
                })}
                {films.length === 0 && <li className="empty">No films assigned for review.</li>}
            </ul>
        </section>
    );
}
