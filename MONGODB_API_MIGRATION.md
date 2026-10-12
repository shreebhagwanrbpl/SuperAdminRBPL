# Admin MongoDB API changes

- Added `POST /api/public-query` for public website contact/product enquiries. It validates the website assignment and writes through `setDocument` to MongoDB.
- Catalog and page APIs continue to read from the existing MongoDB collections/document store.
- MongoDB credentials are no longer hard-coded in `lib/mongodb.js`; configure `MONGODB_URI` and `MONGODB_DB` in the Admin server environment.

**Security action required:** the previously uploaded source archive contained a MongoDB Atlas credential. Rotate that database user's password in Atlas, update the Admin host's `MONGODB_URI` secret, and remove the old credential from any copies/backups.
