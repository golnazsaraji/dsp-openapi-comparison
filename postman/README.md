# Postman Collection

This folder contains a Postman collection for testing the generated Film Manager API.

## Collection

```text
film-manager-api.postman_collection.json
```

## How To Use

1. Start the generated custom server:

```bash
npm start
```

2. Import the collection into Postman.

3. Check the collection variable:

```text
baseUrl = http://localhost:3000
```

4. If you imported an older copy before this update, delete it from Postman and import
   the collection again.

5. Run the whole collection with Runner, or run requests in this order for the main flow:

```text
Health and Docs / Health check
Sessions / Login as Frank
Sessions / Current session
Public Films / List public films
Films / List films to review
Films / Select active film
Films / Create public film
Films / Update created film
Reviews / Invite reviewer to created film
Reviews / Remove review invitation
Reviews / Generate automatic review invitations
Reviews / Complete current user's review
Realtime Status / Online users snapshot
Conflict Scenario / Login as Karen
Conflict Scenario / Try selecting Frank's active film
Error Cases / Reject invalid login
Error Cases / Login as Frank for error checks
Error Cases / Reject invalid pagination
Error Cases / Reject film without title
Error Cases / Reject missing public film
Error Cases / Reject duplicate automatic invitations
Error Cases / Login as Karen for forbidden checks
Error Cases / Reject updating another user film
Error Cases / Reject private film image access
Error Cases / Login as Frank for conflict checks
Error Cases / Reject changing film visibility
Error Cases / Reject missing image film
Cleanup / Login as Frank
Cleanup / Delete created film
Cleanup / Clear active film
```

The backend stores data in memory, so created films and their IDs reset whenever the server
restarts or regenerates. Postman collection variables persist until they are overwritten.
After every server restart, run `Sessions / Login as Frank` and then
`Films / Create public film`; the create request stores the current response ID in the
collection variable `createdFilmId`. Cleanup is last because the reviews, conflict scenario,
and error checks need that temporary data to still exist.

`Images / Upload image` uses `{{createdFilmId}}`. Run the two requests above after the latest
server start, then open `Images / Upload image` and select a local PNG, JPG, or GIF manually
under **Body → form-data → image**. The committed collection intentionally contains no local
file path.

The `Error Cases / Reject unsupported image representation` request is skipped unless
`createdImageId` exists, because it needs an uploaded image before it can verify the `406`
content-negotiation response.
