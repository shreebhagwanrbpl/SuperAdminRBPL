# SuperAdminRBPL — VPS + SQLite deployment

## Requirements
- Node.js 22.5+
- npm
- Linux VPS

## Install
```bash
npm ci
```

## Development
```bash
npm run dev
```

## Production
```bash
npm run build
npm start
```

Do **not** use `next export` and do **not** configure `output: "export"`.
SQLite requires the Next.js Node server because `/api/local-firestore` is a runtime API route.

## SQLite
The database is:
```text
data/catalog.db
```

The application stores Firestore-style document paths such as:
```text
websites/globalbiomedicalorg/pages/home
websitesQueries/globalbiomedicalorg/contactQueries/<document-id>
websitesQueries/globalbiomedicalorg/productQueries/<document-id>
```

## Uploads
Uploaded media is stored under:
```text
public/uploads/
```

## Optional migration from Firebase
Configure the Firebase migration variables in `.env.local`, then run:
```bash
npm run migrate:firebase
```

Keep a backup of the original Firebase data until the SQLite copy is verified.

## PM2 example
```bash
npm install -g pm2
pm2 start npm --name superadminrbpl -- start
pm2 save
pm2 startup
```
