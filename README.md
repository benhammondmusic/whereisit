# Where Is It

Keep track of where things are around the house.

## Status

Early planning. Spec coming soon.

## Architecture

- **Frontend:** React + Vite, responsive for desktop and mobile, installable as a PWA. Native iOS (React Native / Expo) possible later.
- **Hosting & API:** Cloudflare Pages + Workers (Pages Functions).
- **Database:** Cloudflare D1 (SQLite).
- **Photos:** Cloudflare R2, compressed client-side before upload.
- **Auth:** simple shared password to start.

All of the above fits within Cloudflare's free tier.

## Data model

Everything is a single `Thing`. Anything can contain other things and be contained by something else (e.g. a suitcase holds clothes and sits on a garage attic shelf).

```
Thing { id, name, parentId, notes, tags, photo?, createdAt, updatedAt }
```

- `parentId` points to what the thing is inside, or is null for a top-level place.
- A thing is a "container" simply when other things point to it.
- Moving a thing means changing its `parentId`; its contents come along.
- Location paths (Garage › Attic Shelf › Suitcase) come from walking up parents.
