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
Reviews / Complete current user's review
Realtime Status / Online users snapshot
Conflict Scenario / Login as Karen
Conflict Scenario / Try selecting Frank's active film
Cleanup / Login as Frank
Cleanup / Delete created film
Cleanup / Clear active film
```

The collection stores `createdFilmId` automatically after creating a film. Cleanup is
last because the reviews and conflict scenario need that temporary data to still exist.

Image upload is skipped by default in collection runs because Postman needs a local file
selected manually. Run `Films / Create public film` first, then set this collection variable:

```text
runImageUpload = true
```

Then select a local PNG, JPG, or GIF file in `Images / Upload image` before running the
image requests.
