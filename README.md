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
- Firebase project: `transformative-books-app`
- Firebase web app id: `1:903048096742:web:b26536e8c0f4e3d66dc427`
- Firestore default database location: `eur3`
- Firestore rules/indexes deployed from this repo

### Required console steps (one-time)

In Firebase Console > Authentication > Sign-in method:

- Enable `Email/Password`
- Enable `Google`

If you need to re-provision Firestore from CLI:

```bash
firebase firestore:databases:create --project transformative-books-app --location eur3 "(default)"
firebase deploy --only firestore:rules,firestore:indexes --project transformative-books-app
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
