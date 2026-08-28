// Pure mapping from a failed active-film-selection API error (see
// ../api.js, which sets err.status from the HTTP response) to a
// user-facing message. Kept separate from FilmsToReviewPage.jsx so the
// HTTP 409 conflict case can be unit-tested directly, without a React
// component-rendering harness.
export function describeSelectionError(error) {
    if (error?.status === 409) {
        return 'This film is already active for another reviewer right now. Please choose a different film.';
    }
    return error?.message || 'Unable to select this film as active.';
}

// Pure guard for FilmsToReviewPage.jsx: true while no selection request is
// already in flight. Kept as a standalone function (rather than inlined
// `pendingFilmId === null`) so the duplicate-request guard is directly
// unit-testable without a React component-rendering harness.
export function canStartSelection(pendingFilmId) {
    return pendingFilmId === null;
}
