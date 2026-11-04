import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";
import { createAuth } from "./lib/auth.js";
import { openDatabase } from "./lib/db.js";
import { Store } from "./lib/store.js";
import { ApiError } from "./lib/util.js";
import adminRoutes from "./routes/admin.js";
import printRoutes from "./routes/print.js";
import publicRoutes from "./routes/public.js";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const DEFAULT_ADMIN_PASSWORD = "bakery123";

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  next();
}

function sameOriginGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  try {
    if (new URL(origin).host !== req.get("host")) {
      return res.status(403).json({ error: "Cross-site request blocked." });
    }
  } catch {
    return res.status(403).json({ error: "Cross-site request blocked." });
  }
  return next();
}

export async function createApp(options = {}) {
  const adminPassword =
    options.adminPassword ||
    process.env.ADMIN_PASSWORD ||
    DEFAULT_ADMIN_PASSWORD;

  const db = await openDatabase({
    url: options.databaseUrl,
    dataDir: options.dataDir || process.env.DATA_DIR || path.join(rootDir, "data"),
  });
  const store = new Store(db);
  await store.init();

  const secret =
    options.sessionSecret ||
    process.env.SESSION_SECRET ||
    (await store.getSessionSecret());
  const auth = createAuth({ password: adminPassword, secret });

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(sameOriginGuard);
  app.use(express.json({ limit: "4mb" }));

  app.get("/admin", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(publicDir, "admin.html"));
  });
  app.use(express.static(publicDir, { extensions: ["html"] }));

  app.use("/api", publicRoutes({ store }));
  app.use("/api/admin", adminRoutes({ store, auth }));
  app.use("/bill", printRoutes({ store, auth }));

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.use((req, res) => {
    res
      .status(404)
      .type("html")
      .send(
        "<!doctype html><meta charset=\"utf-8\"><title>Not found</title><body style=\"font-family:system-ui;padding:3rem\"><h1>404</h1><p>That page doesn't exist. <a href=\"/\">Back to the bakery</a>.</p></body>",
      );
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ApiError) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "That upload is too large." });
    }
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "That request wasn't valid." });
    }
    console.error("[server] Unhandled error:", error);
    return res
      .status(500)
      .json({ error: "Something went wrong on our side. Please try again." });
  });

  return { app, store, close: () => db.close() };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const port = Number(process.env.PORT || 4173);
  const { app } = await createApp();
  app.listen(port, () => {
    console.log(`Royal Bite is baking at http://localhost:${port}`);
    console.log(`Admin dashboard:      http://localhost:${port}/admin`);
    if (!process.env.ADMIN_PASSWORD) {
      console.warn(
        "[admin] Using the default password \"bakery123\". Set ADMIN_PASSWORD before sharing this app.",
      );
    }
  });
}
