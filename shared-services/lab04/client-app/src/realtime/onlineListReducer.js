// Pure reducer for the Lab04 online-users list: given the current list and
// one incoming WebSocket status message, returns the next list. No React
// dependency, so it is unit-testable in plain Node (see src/test/onlineListReducer.test.js)
// and safe to call from a functional setState updater (never mutates its input).
export function applyOnlineStatusMessage(onlineUsers, message) {
    const currentUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
    if (!message || typeof message !== 'object' || typeof message.typeMessage !== 'string') {
        return currentUsers;
    }

    if (message.typeMessage === 'logout') {
        return currentUsers.filter((user) => user.userId !== message.userId);
    }

    if (message.typeMessage !== 'login' && message.typeMessage !== 'update') {
        // Unknown message type: ignore defensively rather than guessing intent.
        return currentUsers;
    }

    const nextUser = {
        userId: message.userId,
        userName: message.userName,
        ...(message.filmId != null ? { filmId: message.filmId, filmTitle: message.filmTitle } : {}),
    };

    const existingIndex = currentUsers.findIndex((user) => user.userId === message.userId);
    if (existingIndex === -1) return [...currentUsers, nextUser];
    // Login or update for an already-listed user: replace, never duplicate.
    return currentUsers.map((user, index) => (index === existingIndex ? nextUser : user));
}
