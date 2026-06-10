# Service Implementations

This directory contains concrete handwritten service implementations.

## Contents

- `FilmManagerService.js`: in-memory Film Manager service used by the adapter layer.
- `InitialFilmService.js`: in-memory service for the restored initial simple OpenAPI example.
- `FilmService.js`: compatibility export for older generated code; it re-exports `FilmManagerService.js`.

`InitialFilmService.js` is called by `adapters/initial-example/DefaultServiceAdapter.js`
from the restored initial generated server in `../../../generated-openapi-generator/`.
`FilmManagerService.js` represents the business logic of the final DSP Film Manager API.

## Lab-Spec Coverage

| Lab area | Implemented behavior |
|---|---|
| Session and status API | Health/status checks, login, current-user lookup, and logout. |
| Public film catalogue | Paginated public film list/detail endpoints and paginated public review reads. |
| Authenticated film management | Owned-film CRUD plus paginated lists for owned films and films assigned to the current reviewer. |
| Review and image workflows | Reviewer invitation/removal, automatic invitation creation, current-review completion, and Lab02 image metadata reads. |
| Realtime active-film behavior | Lab04 online-user snapshot, active-film selection, clearing the current active film, WebSocket status-message helpers, Lab05 MQTT film-selection messages, and `409` conflict detection when another reviewer already has the film active. |

The service keeps data in memory because the project goal is generator comparison and
regeneration safety, not database persistence.

Image list operations intentionally return a JSON array rather than a paginated object because Lab02 states that pagination is not necessary for images.
