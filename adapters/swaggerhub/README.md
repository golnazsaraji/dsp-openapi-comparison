# SwaggerHub Adapter

This directory contains the adapter used by the server stub generated through SwaggerHub / Swagger Codegen.

## Contents

- `DefaultServiceAdapter.js`: maps SwaggerHub generated service calls to the shared handwritten `FilmService`.

The SwaggerHub generated service layer passes parameters more directly, for example `id` or `newFilm`. This adapter follows that calling convention and forwards the request to `shared-services/src/services/FilmService.js`.

This file is handwritten and should remain outside the generated project directory.
