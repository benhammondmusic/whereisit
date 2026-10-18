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

## Development

```sh
npm install
cp .dev.vars.example .dev.vars   # sets APP_PASSWORD for local dev
npm run db:migrate:local
npm run dev                      # Vite on :5173, API on :8788
```

## Deploy (first time)

```sh
npx wrangler login
npx wrangler d1 create whereisit     # paste the database_id into wrangler.toml
npm run db:migrate:remote
npx wrangler r2 bucket create whereisit-photos
npx wrangler pages project create whereisit
npx wrangler pages secret put APP_PASSWORD --project-name whereisit
npm run deploy
```

## API

All routes require `Authorization: Bearer <APP_PASSWORD>`. `X-User: <name>` records who made a change.

| Method | Path                     | Notes                                                                  |
| ------ | ------------------------ | ---------------------------------------------------------------------- |
| GET    | `/api/things`            | All things                                                             |
| POST   | `/api/things`            | `{ name, parentId?, notes?, tags?, obtainedOn?, replaceBy? }`          |
| GET    | `/api/things/:id`        |                                                                        |
| PATCH  | `/api/things/:id`        | Any subset of fields; blocks moving into self; logs moves              |
| DELETE | `/api/things/:id`        | Contents move up to the deleted thing's parent                         |
| GET    | `/api/things/:id/events` | History (created, moved)                                               |
| PUT    | `/api/things/:id/photo`  | Raw image body; client compresses to ~1600px JPEG first                |
| GET    | `/api/things/:id/photo`  |                                                                        |
| DELETE | `/api/things/:id/photo`  |                                                                        |

## Data model

Everything is a single `Thing`. Anything can contain other things and be contained by something else (e.g. a suitcase holds clothes and sits on a garage attic shelf).

```
Thing { id, name, parentId, notes, tags, photoKey, obtainedOn, replaceBy, createdBy, updatedBy, createdAt, updatedAt }
```

- `replaceBy` drives the "Replacing soon" list (within 90 days or overdue).
- An `events` table records creates and moves, with location paths stored as text so history survives renames and deletes.

- `parentId` points to what the thing is inside, or is null for a top-level place.
- A thing is a "container" simply when other things point to it.
- Moving a thing means changing its `parentId`; its contents come along.
- Location paths (Garage › Attic Shelf › Suitcase) come from walking up parents.
