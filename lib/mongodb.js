import { MongoClient } from "mongodb";

const MONGODB_DB = process.env.MONGODB_DB || "company_master_cms";

let cachedClient = global._mongoClient || null;
let cachedDb = global._mongoDb || null;

export function createMongoClient(rawUri) {
  let uri = rawUri || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/company_master_cms";

  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD || process.env.MONGODB_PASS;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "company_master_cms";

  const options = {
    maxPoolSize: 20,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  };

  if (user && pass) {
    options.auth = { username: user, password: pass };
    options.authSource = authSource;
    uri = "mongodb://127.0.0.1:27017/" + MONGODB_DB;
  } else if (uri.includes("://") && uri.includes("@")) {
    try {
      const match = uri.match(/^mongodb:\/\/([^:]+):([^@]+)@(.+)$/);
      if (match) {
        const u = match[1];
        const p = match[2];
        const rest = match[3];
        uri = `mongodb://${encodeURIComponent(decodeURIComponent(u))}:${encodeURIComponent(decodeURIComponent(p))}@${rest}`;
      }
    } catch {}
  }

  return new MongoClient(uri, options);
}

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = createMongoClient();
  await client.connect();
  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;
  global._mongoClient = client;
  global._mongoDb = db;

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

export async function getDocumentsCol() {
  const db = await getDb();
  return db.collection("documents");
}
