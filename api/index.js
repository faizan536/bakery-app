import { createApp } from "../server.js";

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createApp({}).then(({ app }) => app);
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();

  // When invoked directly as /api/index.js, normalize to /api so Express
  // route mounting (app.use("/api", ...)) matches correctly.
  if (req.url === "/api/index.js" || req.url === "/api/index.js/") {
    req.url = "/api";
  }

  return app(req, res);
}
