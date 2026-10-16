import { MongoClient } from "mongodb";
import dns from "node:dns";

// Fix for Linux VPS system resolver failing SRV records
if (process.platform === "linux") {
  try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
  } catch {
    // Ignore DNS config error if not permitted
  }
}

const MONGODB_DB = process.env.MONGODB_DB || "company_master_cms";

let cachedClient = global._mongoClient || null;
let cachedDb = global._mongoDb || null;
let cachedClientPromise = global._mongoClientPromise || null;

export function sanitizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== "string") return rawUri;
  if (!rawUri.startsWith("mongodb://") && !rawUri.startsWith("mongodb+srv://")) return rawUri;

  const protocol = rawUri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
  const rest = rawUri.slice(protocol.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) return rawUri;

  const userPass = rest.slice(0, lastAt);
  const hostAndQuery = rest.slice(lastAt + 1);
  const firstColon = userPass.indexOf(":");
  if (firstColon === -1) return rawUri;

  const u = userPass.slice(0, firstColon);
  const p = userPass.slice(firstColon + 1);

  const encodedUser = encodeURIComponent(decodeURIComponent(u));
  const encodedPass = encodeURIComponent(decodeURIComponent(p));

  return `${protocol}${encodedUser}:${encodedPass}@${hostAndQuery}`;
}

export function maskMongoUri(uri) {
  if (!uri) return "";
  const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : (uri.startsWith("mongodb://") ? "mongodb://" : "");
  if (!protocol) return uri;
  const rest = uri.slice(protocol.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) return uri;
  const userPass = rest.slice(0, lastAt);
  const hostAndQuery = rest.slice(lastAt + 1);
  const firstColon = userPass.indexOf(":");
  if (firstColon === -1) return uri;
  const u = userPass.slice(0, firstColon);
  return `${protocol}${u}:****@${hostAndQuery}`;
}

export const CLOUD_ATLAS_MONGODB_URI =
  "mongodb+srv://rajbiosis15_db_user:R7jmlgZ3RfeB0MEz@superadminrbpl.aneatej.mongodb.net/company_master_cms?retryWrites=true&w=majority&readPreference=primaryPreferred";

export const CLOUD_ATLAS_DIRECT_URI =
  "mongodb://rajbiosis15_db_user:R7jmlgZ3RfeB0MEz@ac-xdnyrrg-shard-00-00.aneatej.mongodb.net:27017,ac-xdnyrrg-shard-00-01.aneatej.mongodb.net:27017,ac-xdnyrrg-shard-00-02.aneatej.mongodb.net:27017/company_master_cms?ssl=true&replicaSet=atlas-c27e2k-shard-0&authSource=admin&retryWrites=true&w=majority&readPreference=primaryPreferred";

export function getMongoUri(rawUri) {
  if (rawUri) return rawUri;
  return process.env.MONGODB_URI || CLOUD_ATLAS_DIRECT_URI;
}

export function createMongoClient(rawUri) {
  let uri = getMongoUri(rawUri);
  if (!uri) {
    throw new Error("MONGODB_URI is required. Configure it in the Admin server environment.");
  }

  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD || process.env.MONGODB_PASS;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  const options = {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    tls: true,
    readPreference: "primaryPreferred",
  };

  if (user && pass) {
    options.auth = { username: user, password: pass };
    options.authSource = authSource;
  } else {
    uri = sanitizeMongoUri(uri);
  }

  return new MongoClient(uri, options);
}

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!cachedClientPromise) {
    cachedClientPromise = (async () => {
      const client = createMongoClient(getMongoUri());
      try {
        await client.connect();
        return client;
      } catch (err) {
        console.warn("[mongodb] Primary URI connection failed, trying direct fallback:", err.message);
        const directClient = createMongoClient(CLOUD_ATLAS_DIRECT_URI);
        await directClient.connect();
        return directClient;
      }
    })();
    global._mongoClientPromise = cachedClientPromise;
  }

  let client;
  try {
    client = await cachedClientPromise;
  } catch (err) {
    cachedClientPromise = null;
    global._mongoClientPromise = null;
    throw err;
  }
  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;
  global._mongoClient = client;
  global._mongoDb = db;

  if (!global._indexesEnsured) {
    global._indexesEnsured = true;
    (async () => {
      try {
        await Promise.allSettled([
          db.collection("documents").createIndex({ collection_path: 1 }, { background: true }),
          db.collection("documents").createIndex({ path: 1 }, { background: true }),
          db.collection("categories").createIndex({ organizationId: 1 }, { background: true }),
          db.collection("products").createIndex({ organizationId: 1, type: 1 }, { background: true }),
          db.collection("products").createIndex({ organizationId: 1, categoryId: 1, subcategoryId: 1 }, { background: true }),
          db.collection("pages").createIndex({ websiteId: 1 }, { background: true }),
          db.collection("queries").createIndex({ websiteId: 1, type: 1 }, { background: true }),
        ]);
      } catch {
        // Ignore background index creation warning
      }
    })();
  }

  return { client, db };
}

export async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}

export async function getOrganizationsCol() {
  const db = await getDb();
  return db.collection("organizations");
}

export async function getWebsitesCol() {
  const db = await getDb();
  return db.collection("websites");
}

export function getCompanyProductsCollectionName(orgOrCompany) {
  const raw = String(orgOrCompany || "").trim().toUpperCase();
  if (raw === "HUMAN" || raw === "HUMANBIOMEDICAL" || raw === "HUMANBIOMEDICALS") {
    return "human_products";
  }
  if (raw === "GLOBAL" || raw === "GLOBALBIOMEDICAL" || raw === "GLOBALBIOMEDICALS") {
    return "global_products";
  }
  return "rbpl_products";
}

export async function getCompanyProductsCol(orgOrCompany) {
  const db = await getDb();
  const colName = getCompanyProductsCollectionName(orgOrCompany);
  return db.collection(colName);
}

export async function getRbplProductsCol() {
  const db = await getDb();
  return db.collection("rbpl_products");
}

export async function getHumanProductsCol() {
  const db = await getDb();
  return db.collection("human_products");
}

export async function getGlobalProductsCol() {
  const db = await getDb();
  return db.collection("global_products");
}

export async function getCategoriesCol() {
  const db = await getDb();
  return db.collection("categories");
}

export async function getProductsCol() {
  const db = await getDb();
  return db.collection("products");
}

export async function getPagesCol() {
  const db = await getDb();
  return db.collection("pages");
}

export async function getQueriesCol() {
  const db = await getDb();
  return db.collection("queries");
}

export async function getUsersCol() {
  const db = await getDb();
  return db.collection("users");
}

export async function getHomeCol() {
  const db = await getDb();
  return db.collection("home");
}

export async function getServicesCol() {
  const db = await getDb();
  return db.collection("services");
}

export async function getContactCol() {
  const db = await getDb();
  return db.collection("contact");
}

export async function getDistrictsCol() {
  const db = await getDb();
  return db.collection("districts");
}

export async function getDocumentsCol() {
  const db = await getDb();
  return db.collection("documents");
}
