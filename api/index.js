import { createApp } from "../server.js";

// Bills and "today" totals should follow the bakery's clock, not the server's (UTC).
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = createApp()
      .then(({ app }) => app)
      .catch((error) => {
        appPromise = null; // retry on the next request instead of staying broken
        throw error;
      });
  }
  return appPromise;
}

export default async function handler(req, res) {
  let app;
  try {
    app = await getApp();
  } catch (error) {
    console.error("[startup]", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error:
          error.publicMessage ||
          "The app couldn't connect to its database. Please try again shortly.",
      }),
    );
    return;
  }
  app(req, res);
}
