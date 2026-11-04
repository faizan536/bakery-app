# Royal Bite

A small bakery storefront and back office: menu, pickup orders, loyalty stamps, counter billing, and a WhatsApp-first workflow. Node + Express on Vercel, with all data (including cake photos) in one Postgres database (Neon).

## Run locally

No database setup is needed locally: without `DATABASE_URL`, the app uses an embedded Postgres (PGlite) stored in `data/pglite`.

```bash
npm install
ADMIN_PASSWORD=choose-something npm start
```

- Storefront: http://localhost:4173
- Back office: http://localhost:4173/admin
- Default admin password is `bakery123` if `ADMIN_PASSWORD` is not set.

For development with auto-restart:

```bash
npm run dev
```

Run the test suite:

```bash
npm test
```

## Environment

| Variable           | Required | Purpose                                        |
| ------------------ | -------- | ---------------------------------------------- |
| `DATABASE_URL`     | on Vercel | Postgres connection string (added by the Neon integration) |
| `ADMIN_PASSWORD`   | yes online | Back-office password (default `bakery123`)    |
| `SESSION_SECRET`   | no       | Cookie signing secret (generated and stored in the database if unset) |
| `APP_TIMEZONE`     | no       | Timezone for bill dates and daily totals (default `Asia/Kolkata`) |
| `PORT`             | no       | Local dev port (default `4173`)                |

## How it works

- **Storefront** (`public/index.html`): browse the menu, add items to a pickup cart, choose a pickup day and slot, leave kitchen notes, and place the order. Orders are confirmed on screen and via a prepared WhatsApp message. Customers can also look up their loyalty stamps by phone number and request a custom cake (48 hours notice, optional reference image).
- **Back office** (`public/admin.html`): order board with filters and status buttons (`new` → `ready` → `completed`), menu management (add/edit/delete, sold-out toggle, photo upload), customer list with spend and stamps, and settings (bakery details, WhatsApp number, currency, loyalty target, pickup slots, closed weekdays, opening hours, checkout notice).
- **Counter billing**: sign in at `/admin`, tap **Billing**, tap items to set quantities, add a customer name/phone if needed, then **Save & print bill**. The bill shows the bakery name, tagline, address and phone, an itemised table with quantities and line totals, item count, and grand total. The **View · Print** link opens a print-ready page; **Download PDF** saves a black-and-white receipt PDF. Bills are stored in the database and listed under Recent bills for reprinting.
- **Loyalty**: marking an order picked up adds one stamp. Ten stamps (configurable) earns a free bake. Redeeming resets the stamp counter.
- **Data**: orders, bills, customers, menu, settings, loyalty, and cake reference photos live in Postgres (`rb_*` tables, created automatically on first start).

## Deploy on Vercel

This project is live at https://bakery-app-sooty.vercel.app (Vercel project `bakery-app`, Neon database `royal-bite-db`, both in Singapore `sin1`). Every push to `main` on GitHub deploys automatically.

To set it up from scratch:

1. Import the GitHub repo into Vercel.
2. Vercel → Storage → add **Neon** Postgres and connect it to the project (this adds `DATABASE_URL`).
3. Settings → Environment Variables → add `ADMIN_PASSWORD`.
4. Redeploy. Tables and the starting menu are created automatically.

`vercel.json` serves `public/` as static files and rewrites `/api/*` and `/bill/*` to the Express function in `api/index.js`.

**Backups:** open Vercel → Storage → royal-bite-db → Open in Neon to see the data and take exports.

## Customize

- **Branding and contents**: back office → Settings. The seed data (name, address, menu, hours) lives in `lib/seed.js`.
- **Look and feel**: colors and type are CSS variables at the top of `public/styles.css` (storefront) and `public/admin.css` (back office).
- **Payments**: orders are pay-on-pickup by design. To take prepayments, add a payment provider in `routes/public.js` where the order is created.

## Project layout

```
api/index.js             Vercel serverless entry point
server.js                Local dev server (same Express app)
lib/db.js                Postgres connection (pg on Vercel, PGlite locally) + schema
lib/store.js             Postgres store: orders, bills, loyalty, customers, menu, settings
lib/seed.js              Default settings and menu
lib/auth.js              Signed-cookie admin sessions
lib/util.js              Validation helpers and rate limiting
routes/public.js         Storefront API: bootstrap, orders, loyalty, cake photos
routes/admin.js          Back-office API: auth, orders, menu, customers, settings, bills
routes/print.js          Printable bill page and PDF (/bill/:id, /bill/:id.pdf)
public/                  Storefront and back office (vanilla HTML/CSS/JS)
vercel.json              Vercel config (static files, rewrites, region)
.env.example             Environment variable template
test/smoke.test.js       End-to-end API tests
```
