# SQLite catalog setup (local + deployment)

## Data model

The company master catalog is stored at these document paths:

- `companies/{companyId}/categories/{categoryId}`
- `companies/{companyId}/categories/{categoryId}/subcategories/{subcategoryId}`
- `companies/{companyId}/products/{productId}` for standalone products

Category products remain embedded in each subcategory document's `products` array. The catalog API resolves `websiteId` through `lib/websiteCompanyMap.js`, then reads only the assigned company's master catalog and applies category, subcategory, product website visibility and publish-status rules.

## SQLite database path

By default the application uses `./data/catalog.db` relative to the project directory. You can override it with `SQLITE_DB_PATH` in `.env.local` or the deployment environment. Relative override paths are resolved from the project root; absolute paths are used as-is.

Example local setting:

```env
SQLITE_DB_PATH=./data/catalog.db
```

On a VPS, use the absolute path to the persistent database, for example:

```env
SQLITE_DB_PATH=/root/SuperAdminRBPL/data/catalog.db
```

Do not point the production process at a temporary build directory. Ensure the process user can read and write the database directory, and back up `catalog.db` before deploying schema or data migrations.

## Local vs production data

SQLite files are local to the machine/container that runs the application. A local Windows `data/catalog.db` and the VPS `catalog.db` are separate databases; changing the path variable does not synchronize them over the network. If local development must read/write the exact same live records as production, use a secured shared API as the single source of truth or perform an explicit, backed-up database sync. Do not expose a writable SQLite database file publicly.

## Website mapping note

A website ID must belong to exactly one company. `humanbiomedicalscom` appeared in both company lists in the supplied configuration; it is assigned to `human` in the canonical map to avoid ambiguous routing. Review this assignment if that website was intended to belong to `rajbiosis` instead.
