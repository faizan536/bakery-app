import crypto from "node:crypto";

export const ADMIN_COOKIE = "gc_admin";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AGE_SECONDS = Math.floor(MAX_AGE_MS / 1000);

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

export function createAuth({ password, secret }) {
  const key = crypto.createHash("sha256").update(String(secret)).digest();

  function sign(payload) {
    return crypto.createHmac("sha256", key).update(payload).digest("base64url");
  }

  function issueToken() {
    const expires = Date.now() + MAX_AGE_MS;
    const nonce = crypto.randomBytes(12).toString("base64url");
    const payload = `${expires}.${nonce}`;
    return `${payload}.${sign(payload)}`;
  }

  function verifyToken(token) {
    if (!token || typeof token !== "string") return false;
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = `${parts[0]}.${parts[1]}`;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(parts[2]);
    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return false;
    }
    const expires = Number(parts[0]);
    return Number.isFinite(expires) && expires > Date.now();
  }

  function checkPassword(input) {
    if (typeof input !== "string" || input.length === 0) return false;
    const given = crypto.createHash("sha256").update(input).digest();
    const expected = crypto
      .createHash("sha256")
      .update(String(password))
      .digest();
    return crypto.timingSafeEqual(given, expected);
  }

  function isAuthed(req) {
    const cookies = parseCookies(req.headers.cookie);
    return verifyToken(cookies[ADMIN_COOKIE]);
  }

  function requireAdmin(req, res, next) {
    if (!isAuthed(req)) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }
    return next();
  }

  function setSessionCookie(req, res) {
    const secure =
      req.secure || req.headers["x-forwarded-proto"] === "https";
    const flags = [
      `${ADMIN_COOKIE}=${issueToken()}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${MAX_AGE_SECONDS}`,
    ];
    if (secure) flags.push("Secure");
    res.setHeader("Set-Cookie", flags.join("; "));
  }

  function clearSessionCookie(res) {
    res.setHeader(
      "Set-Cookie",
      `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
  }

  return {
    isAuthed,
    requireAdmin,
    checkPassword,
    setSessionCookie,
    clearSessionCookie,
  };
}
