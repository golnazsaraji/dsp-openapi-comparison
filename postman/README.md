# Final Lab01 Postman collection

`film-manager-api.postman_collection.json` is the presentation-ready manual and Runner workflow for the single final generated server. It does not start or compare a professor-solution server.

## Start the server

From the repository root, regenerate when needed and start the final server on the collection's default port:

```bash
npm run generate:final
npm start
```

Import the collection into Postman and confirm its collection variable is:

```text
baseUrl = http://localhost:3000
```

If the server is started on a different port (`PORT=3101 npm start`), update `baseUrl`
to match before running the collection.

## State and cookies

The backend stores users, films, reviews, and assignments in memory. Restarting the Node process resets created resources and generated IDs, while Postman collection variables normally survive. An ID left from an earlier server process may resolve correctly in the URL but no longer identify a resource.

After every server restart, run:

```text
1. Setup and Session / Reset collection state
```

This clears runtime-generated IDs without clearing `baseUrl` or the seeded login credentials. It also asks Postman's cookie jar to clear cookies for `baseUrl` so the first protected-access check is genuinely anonymous.

Postman manages the server's `connect.sid` cookie automatically. Do not copy the cookie into a variable or manually add a Cookie header. Requests that intentionally test anonymous behavior explicitly log out or start after the reset.

## Recommended run order

Run the collection folders from top to bottom:

1. Setup and Session
2. Public API
3. Users
4. Films
5. Reviews
6. Balanced Assignment
7. Images
8. Validation and Error Cases
9. Cleanup

The flow creates and saves all film, reviewer, assignment, and image IDs used later. Do not begin in the middle after restarting the server. Requests that switch identity say so explicitly:

- Films logs in as Karen for non-owner update/delete checks, then restores Frank.
- Reviews logs in as Karen to complete Karen's invitation, then restores Frank.
- Validation and Error Cases switches between Karen and Frank for reviewer validation and forbidden-access checks.

The seeded accounts used by the collection are Frank (`frank@example.com`) as the primary user and Karen (`karen@example.com`) as the secondary/invited reviewer. Their passwords come from the final shared in-memory service and are collection variables rather than copied into request scripts.

## Manual image upload

The committed upload request has an empty file source so it never embeds a developer's local path. Automated Runner/Newman execution skips only the upload request by default.

For manual upload:

1. Complete Setup, Users, and Films so `createdPublicFilmId` belongs to the current server run.
2. Set collection variable `runImageUpload` to `true`.
3. Open `7. Images / Upload image to current-run public film`.
4. Under **Body → form-data**, select a local PNG, JPG, JPEG, or GIF for the `image` field.
5. Send the request. The collection expects 201 and saves `createdImageId`.
6. Run the remaining image metadata requests.

If the server was restarted, reset and recreate the films before uploading. A 404 generally means the saved film ID is stale for the new in-memory process.

## Validation notes

Every core request checks an exact status and important response fields. Login and user tests ensure no password or password hash is returned. Film and review validation tests cover rating boundaries, conditional fields, authorization, missing resources, duplicate invitations, and route/body film consistency.

The canonical Lab01 API has no operation containing both a `{reviewerId}` route parameter and a reviewerId-bearing request body. Reviewer consistency is therefore enforced where reviewerId is defined—the invitation body—and no artificial request body is added to the invitation-delete route.

Lab02–Lab05 are outside this collection update. The existing image request is retained only because preserving that already established upload workflow was explicitly required; no later-lab server workflow or realtime scenario is included.
