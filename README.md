# Royal Bite

A small bakery storefront and back office: menu, pickup orders, loyalty stamps, counter billing, and a WhatsApp-first workflow. Node + Express with Vercel Postgres and Vercel Blob for storage.

## Run locally

You need a Postgres database (local or hosted) and a `.env` file:

```bash
cp .env.example .env
# edit .env with your DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
npm install
npm start
```

- Storefront: http://localhost:4173
- Back office: http://localhost:4173/admin.html
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
| `DATABASE_URL`     | yes      | Vercel Postgres connection string              |
| `BLOB_READ_WRITE_TOKEN` | yes   | Vercel Blob read/write token (for cake images) |
| `ADMIN_PASSWORD`   | no       | Back-office password (default `bakery123`)     |
| `SESSION_SECRET`   | no       | Cookie signing secret                          |
| `PORT`             | no       | Local dev port (default `4173`)                |

## How it works

- **Storefront** (`public/index.html`): browse the menu, add items to a pickup cart, choose a pickup day and slot, leave kitchen notes, and place the order. Orders are confirmed on screen and via a prepared WhatsApp message. Customers can also look up their loyalty stamps by phone number and request a custom cake (48 hours notice, optional reference image).
- **Back office** (`public/admin.html`): order board with filters and status buttons (`new` → `ready` → `completed`), menu management (add/edit/delete, sold-out toggle, photo upload), customer list with spend and stamps, and settings (bakery details, WhatsApp number, currency, loyalty target, pickup slots, closed weekdays, opening hours, checkout notice).
- **Counter billing**: sign in at `/admin`, tap **Billing**, tap items to set quantities, add a customer name/phone if needed, then **Save & print bill**. The bill shows the bakery name, tagline, address and phone, an itemised table with quantities and line totals, item count, and grand total. The **View · Print** link opens a print-ready page; **Download PDF** saves a black-and-white receipt PDF. Bills are stored in the database and listed under Recent bills for reprinting.
- **Loyalty**: marking an order picked up adds one stamp. Ten stamps (configurable) earns a free bake. Redeeming resets the stamp counter.
- **Data**: orders, bills, customers, menu, settings, and loyalty live in Vercel Postgres. Cake reference images are stored in Vercel Blob.

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel, add a **Postgres** database to your project.
3. Add a **Blob** store to your project.
4. Import the GitHub repo as a new Vercel project.
5. Add environment variables in Vercel project settings:
   - `DATABASE_URL` (from Postgres integration)
   - `BLOB_READ_WRITE_TOKEN` (from Blob integration)
   - `ADMIN_PASSWORD` (strong password)
   - `SESSION_SECRET` (random string)
6. Deploy. On first deploy, the schema and seed data are created automatically.
7. Open your Vercel URL → `/admin.html` → sign in with `ADMIN_PASSWORD`.

Vercel routes `/api/*` to the serverless function (`api/index.js`) and serves `public/` as static files.

## Customize

- **Branding and contents**: back office → Settings. The seed data (name, address, menu, hours) lives in `lib/seed.js`.
- **Look and feel**: colors and type are CSS variables at the top of `public/styles.css` (storefront) and `public/admin.css` (back office).
- **Payments**: orders are pay-on-pickup by design. To take prepayments, add a payment provider in `routes/public.js` where the order is created.

## Project layout

```
api/index.js             Vercel serverless entry point
server.js                Local dev server (same Express app)
lib/db.js                Postgres schema + init
lib/store.js             Postgres store: orders, bills, loyalty, customers, menu, settings
lib/seed.js              Default settings and menu
lib/auth.js              Signed-cookie admin sessions
lib/util.js              Validation helpers and rate limiting
routes/public.js         Storefront API: bootstrap, orders, loyalty, Blob uploads
routes/admin.js          Back-office API: auth, orders, menu, customers, settings, bills
public/                  Storefront and back office (vanilla HTML/CSS/JS)
vercel.json              Vercel routing config
.env.example             Environment variable template
test/smoke.test.js       End-to-end API tests
```
