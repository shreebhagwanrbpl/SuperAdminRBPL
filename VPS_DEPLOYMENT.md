# SuperAdminRBPL — VPS + MongoDB deployment

## Requirements
- Node.js 18+
- npm
- Linux VPS / Server
- MongoDB (Atlas or self-hosted)

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
The server requires the Next.js Node server because `/api/db` is a runtime API route connected to MongoDB.

## MongoDB Configuration
Configure environment variables in `.env.local` or VPS environment:
```text
MONGODB_URI=mongodb+srv://...
MONGODB_DB=company_master_cms
```

## Uploads
Uploaded media is stored under:
```text
public/uploads/
```

## PM2 example
```bash
npm install -g pm2
pm2 start npm --name superadminrbpl -- start
pm2 save
pm2 startup
```
