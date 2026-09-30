USER APPROVAL FIX

Files changed:
- app/api/local-auth/route.js
- app/userapproval/page.js

Main fix: GET list/get and login now merge adminUsers document as fallback and give local_users.user_json precedence for current profile/status. Previously a stale adminUsers document could overwrite a newer status/profile. API fetch URLs now include trailing slash to match next.config.mjs (trailingSlash: true), avoiding unnecessary redirects.

IMPORTANT: This fix does not add server-side admin authorization to GET list or POST updateStatus. Protect these endpoints with your real server-side admin session/auth before exposing the app publicly.

Deploy from the project directory after backing up the existing files and database. Rebuild/restart the app with your existing deployment process. Do not overwrite data/catalog.db with this source ZIP.
