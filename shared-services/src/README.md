# Shared Services Source

This directory contains the source files for the handwritten service layer.

## Contents

| Directory | Meaning |
|---|---|
| `services/` | Concrete handwritten service implementations used by the adapters. |

The files in this directory are not generated and are intended to be maintained manually.

`services/FilmManagerService.js` contains the current shared implementation for the
Film Manager API. `services/FilmService.js` is kept as a compatibility entry point for
older generated code and re-exports the same service.

## Source Organization by Lab Area

`FilmManagerService.js` is intentionally handwritten and in-memory. It is grouped around
the five Film Manager lab areas, even though the source remains one file for this
comparison project:

| Lab area | Representative operations |
|---|---|
| Session and status API | `healthGET`, `statusGET`, `sessionsPOST`, `sessionsCurrentGET`, `sessionsCurrentDELETE` |
| Public film catalogue | `filmsPublicGET`, `filmsPublicFilmIdGET`, `filmsPublicFilmIdReviewsGET`, `filmsPublicFilmIdReviewsReviewerIdGET` |
| Authenticated film management | `filmsGET`, `filmsPOST`, `filmsToReviewGET`, `filmsFilmIdGET`, `filmsFilmIdPUT`, `filmsFilmIdDELETE` |
| Review and image workflows | `reviewsAutoInvitationsPOST`, `filmsFilmIdReviewsPOST`, `filmsFilmIdReviewsReviewerIdDELETE`, `filmsFilmIdReviewsCurrentPUT`, `filmsFilmIdImagesGET`, `filmsFilmIdImagesPOST`, `filmsFilmIdImagesImageIdGET`, `filmsFilmIdImagesImageIdDELETE` |
| Realtime active-film behavior | `usersOnlineGET`, `filmsFilmIdActivePUT`, `usersCurrentActiveFilmDELETE`, `webSocketSnapshot`, `webSocketStatusMessage`, `mqttInitialFilmMessages`, `mqttFilmMessage` |

The operation names match the OpenAPI `operationId` values. This is deliberate: generated
service files can delegate through the adapter layer without knowing the handwritten
implementation details.

Lab02 image list operations return JSON arrays rather than paginated response objects,
matching the image-management specification.
