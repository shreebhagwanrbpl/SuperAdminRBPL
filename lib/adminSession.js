import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const COOKIE_NAME = "rbpl_admin_session";
const ADMIN_EMAIL = String(process.env.ADMIN_INITIAL_EMAIL || "rajbios12@gmail.com").trim().toLowerCase();
function getSecret() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, ".admin-session-secret");
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
    const secret = crypto.randomBytes(48).toString("hex");
    try { fs.writeFileSync(file, secret, { mode: 0o600, flag: "wx" }); } catch {}
    return fs.readFileSync(file, "utf8").trim();
  } catch (error) {
    throw new Error("Unable to initialize admin session secret: " + error.message);
  }
}
function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}
export function createAdminSessionCookie(response, user) {
  if (String(user?.email || "").toLowerCase() !== ADMIN_EMAIL || user?.status !== "approved") return response;
  const payload = Buffer.from(JSON.stringify({ uid: user.uid, email: ADMIN_EMAIL, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  const token = payload + "." + sign(payload);
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 60 * 60,
  });
  return response;
}
export function clearAdminSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
export function isAuthorizedAdminRequest(request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const entry = cookieHeader.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE_NAME + "="));
    if (!entry) return false;
    const token = decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const expected = sign(payload);
    const a = Buffer.from(signature); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.email === ADMIN_EMAIL && Number(data.exp) > Date.now() && !!data.uid;
  } catch { return false; }
}
export function isInitialAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}
