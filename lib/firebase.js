// Clean bridge re-exporting from MongoDB client DB, Auth, and Storage
import { auth } from "./auth.js";
import { db } from "./clientDb.js";
import { storage } from "./storage.js";

export { auth, db, storage };

const app = { auth, db, storage };
export default app;
