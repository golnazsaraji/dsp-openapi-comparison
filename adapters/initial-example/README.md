# Initial Example Adapter

This adapter connects the initial generated OpenAPI example in `../../generated-openapi-generator/` to the handwritten implementation in `../../shared-services/src/services/InitialFilmService.js`.

It is intentionally separate from the final Film Manager adapter because the initial example uses a smaller API shape:

- `GET /status`
- `GET /films`
- `POST /films`
- `GET /films/{id}`
- `DELETE /films/{id}`

The final project API uses `../../adapters/openapi-generator/DefaultServiceAdapter.js` and `../../shared-services/src/services/FilmManagerService.js`.
