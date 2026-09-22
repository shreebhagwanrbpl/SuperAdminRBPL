# SuperAdminRBPL — SQLite/VPS data-store migration

This build keeps the existing Admin UI and data operations, but replaces Firestore reads/writes with a VPS-local SQLite database and replaces Firebase Storage uploads with local VPS uploads.

## Important
- Original Firebase Admin ZIP is untouched; keep it as the rollback backup.
- Firebase Authentication is intentionally retained in this first migration so existing login/account behaviour is not changed.
- Firestore is no longer used by the app runtime.
- Firebase Storage is no longer used by the app runtime.
- Existing document paths are preserved inside SQLite. Example:
  `websites/globalbiomedicalorg/pages/home`
- Existing UI, field names, routes and save/edit/delete flows are preserved.

## Database
SQLite file:
`data/catalog.db`

The database stores a generic `documents` table so existing Firestore document paths and document data can be preserved without redesigning the application's data model.

## Home page example
Current Firebase path discovered in the original Admin:
`websites/globalbiomedicalorg/pages/home`

The same logical path is now stored in SQLite. The Home page's title, description, button text/links and image URL are saved there.

## One-time migration
After Firestore quota is available, configure:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- FIREBASE_STORAGE_BUCKET (optional for media)

Then run:
`npm run migrate:firebase`

This imports Firestore documents into `data/catalog.db` and attempts to copy Firebase Storage files into `public/uploads/`.

Do not delete Firebase data until the migrated VPS copy has been verified.

## Run on VPS
Node.js 22.5+ is required because the project uses Node's built-in `node:sqlite`.

Commands:
`npm install`
`npm run dev`

Production:
`npm run build`
`npm start`

## Runtime flow
Admin -> Next.js API -> SQLite
Admin media upload -> VPS /public/uploads
Website -> same VPS data/API layer
