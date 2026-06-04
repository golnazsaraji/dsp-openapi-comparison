# Service Implementations

This directory contains concrete handwritten service implementations.

## Contents

- `FilmManagerService.js`: in-memory Film Manager service used by the adapter layer.
- `FilmService.js`: compatibility export for older generated code; it re-exports `FilmManagerService.js`.

`FilmManagerService.js` represents the business logic of the DSP Film Manager API. Both
generated servers call it indirectly through their corresponding adapter.

## Lab-Spec Coverage

| Lab area | Implemented behavior |
|---|---|
| Session and status API | Health/status checks, login, current-user lookup, and logout. |
| Public film catalogue | Public film list/detail endpoints and public review reads. |
| Authenticated film management | Owned-film CRUD plus the list of films assigned to the current reviewer. |
| Review and image workflows | Reviewer invitation/removal, current-review completion, and image metadata CRUD. |
| Realtime active-film behavior | Online-user snapshot, active-film selection, clearing the current active film, and `409` conflict detection when another reviewer already has the film active. |

The service keeps data in memory because the project goal is generator comparison and
regeneration safety, not database persistence.
