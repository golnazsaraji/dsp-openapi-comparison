// Relative paths only (same-origin as the API in production; proxied in dev
// by vite.config.js) — never a hard-coded host/port, matching the WebSocket
// URL derivation in src/realtime/onlineStatusSocket.js.
async function request(method, path, body) {
    const response = await fetch(path, {
        method,
        credentials: 'include',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    const text = await response.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            data = null;
        }
    }
    if (!response.ok) {
        const message = (data && (data.error || data.message)) || `Request failed with status ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return data;
}

const API = {
    login: (email, password) => request('POST', '/api/sessions', { email, password }),
    logout: () => request('DELETE', '/api/sessions/current'),
    currentSession: () => request('GET', '/api/sessions/current'),
    onlineUsers: () => request('GET', '/api/users/online'),
    filmsToReview: () => request('GET', '/api/films/to-review'),
    selectActiveFilm: (filmId) => request('PUT', `/api/films/${filmId}/active`),
    clearActiveFilm: () => request('DELETE', '/api/users/current/active-film'),
};

export default API;
