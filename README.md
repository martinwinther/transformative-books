# Transformative Books

Cross-device reader progress sync is implemented with Firebase Auth + Firestore and deployed via Netlify.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create local env:
   ```bash
   cp .env.example .env.local
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```

## Firebase status

- Firebase account used: `martin.winther@gmail.com`
- Firebase project: `transformative-books-secure`
- Firebase web app id: `1:285245651421:web:d8cf6c9ac85dfb73619e34`
- Firestore default database location: `eur3`
- Firestore rules/indexes deployed from this repo

### Required console steps (one-time)

In Firebase Console > Authentication > Sign-in method:

- Enable `Email/Password`
- Enable `Google`

If you need to re-provision Firestore from CLI:

```bash
firebase firestore:databases:create --project transformative-books-secure --location eur3 "(default)"
firebase deploy --only firestore:rules,firestore:indexes --project transformative-books-secure
```

If authentication providers are not enabled, sign-in calls will fail with `auth/operation-not-allowed`.

## Rules testing

Run Firestore rules tests:

```bash
npm run test:firestore-rules
```

Note: Firestore emulator requires Java installed locally.

## Netlify status

- Netlify account: `mswinther@icloud.com`
- Site: `transformative-books-app`
- URL: <https://transformative-books-app.netlify.app>
- GitHub CI/CD is configured for branches + pull requests via `netlify init`.

## Public Books API

The site publishes a static, machine-readable books API at:

- <https://transformative-books-app.netlify.app/api/v1/books>

This endpoint returns an envelope object:

```json
{
   "version": "v1",
   "generatedAt": "2026-04-19T12:34:56.000Z",
   "count": 123,
   "data": [
      {
         "author": "...",
         "title": "...",
         "rating": 5,
         "genres": ["..."],
         "justification": "...",
         "expandedJustification": "...",
         "transformativeExperience": "...",
         "amazonLink": "https://...",
         "slug": "...",
         "canon": "western",
         "canonSources": ["western", "eastern"]
      }
   ]
}
```

### Regenerating endpoint data

The payload is generated at build time from:

- `public/western-canon.csv`
- `public/eastern-canon.csv`

Commands:

```bash
npm run generate:books-api
npm run build
```

`npm run build` automatically runs `npm run generate:books-api` before Vite builds `dist`.

## Secure User Progress API

The site also exposes an authenticated endpoint for the currently logged-in user:

- `GET /api/v1/me/progress`

This endpoint requires a Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase_id_token>
```

The server verifies the token using Firebase Admin SDK, derives the user id from the verified token, and only returns `users/{uid}/bookProgress` for that uid.

Response shape:

```json
{
   "uid": "firebase_uid",
   "count": 2,
   "data": {
      "book-slug": {
         "isRead": true,
         "owns": false,
         "userRating": 4,
         "notes": "...",
         "updatedAt": 1762730695000,
         "updatedByDevice": "device-id"
      }
   }
}
```

### Server environment variables (Netlify)

Set one of these credential options in Netlify site environment variables.

Option A (recommended):

- `FIREBASE_SERVICE_ACCOUNT_JSON`: full Firebase service account JSON as a single string.

Option B:

- `FIREBASE_SERVICE_ACCOUNT_BASE64`: base64-encoded service account JSON.

Option C:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (preserve line breaks or use `\\n` sequences)

Keep these as server-only variables. Do not prefix them with `VITE_`.
