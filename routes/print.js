import express from "express";
import PDFDocument from "pdfkit";
import { ApiError } from "../lib/util.js";

const LOGO_PATH =
  "M32 52V20M32 28c-7 0-12-4.5-12-11 7 0 12 4.5 12 11Zm0 0c7 0 12-4.5 12-11-7 0-12 4.5-12 11Zm0 10c-7 0-12-4.5-12-11 7 0 12 4.5 12 11Zm0 0c7 0 12-4.5 12-11-7 0-12 4.5-12 11Z";

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

function amount(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateLabel(iso) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function timeLabel(iso) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function customerLine(bill) {
  return [bill.customerName, bill.customerPhone].filter(Boolean).join(" · ");
}

function renderHtml(bill, settings) {
  const name = settings.bakeryName || "Royal Bite";
  const currency = settings.currency || "₹";
  const rows = bill.items
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.name)}</td>
          <td class="num">${entry.qty}</td>
          <td class="num">${amount(entry.price)}</td>
          <td class="num">${amount(entry.lineTotal)}</td>
        </tr>`,
    )
    .join("");
  const customer = customerLine(bill);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Bill ${escapeHtml(bill.code)} · ${escapeHtml(name)}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; background: #fff; color: #000; }
      body {
        font: 13px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-variant-numeric: tabular-nums;
      }
      .receipt {
        width: 80mm;
        max-width: calc(100% - 24px);
        margin: 24px auto 16px;
        padding: 6mm 5mm;
        border: 1px solid #000;
      }
      .center { text-align: center; }
      .logo { display: block; width: 42px; height: 42px; margin: 0 auto 6px; }
      h1 {
        margin: 0;
        font-size: 18px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      header p { margin: 1px 0 0; font-size: 12px; }
      hr { border: 0; border-top: 1px dashed #000; margin: 10px 0; }
      .meta div { display: flex; justify-content: space-between; gap: 8px; }
      .meta span { color: #000; }
      table { width: 100%; border-collapse: collapse; }
      th {
        text-align: left;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-bottom: 1px solid #000;
        padding: 0 0 4px;
      }
      td { padding: 4px 0; vertical-align: top; }
      th.num, td.num { text-align: right; padding-left: 6px; white-space: nowrap; }
      tbody tr:last-child td { padding-bottom: 6px; }
      .totals { border-top: 1px solid #000; padding-top: 6px; }
      .totals div { display: flex; justify-content: space-between; }
      .grand {
        margin-top: 4px;
        padding: 5px 0;
        border-top: 1px solid #000;
        border-bottom: 1px solid #000;
        font-size: 16px;
        font-weight: 700;
      }
      .thanks { margin: 0; font-size: 12px; }
      .actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin: 0 auto 32px;
      }
      .actions button, .actions a {
        font-family: inherit;
        font-size: 14px;
        font-weight: 600;
        line-height: 1;
        padding: 11px 18px;
        border: 1px solid #000;
        border-radius: 6px;
        background: #fff;
        color: #000;
        text-decoration: none;
        cursor: pointer;
      }
      .actions button { background: #000; color: #fff; }
      @media print {
        @page { margin: 4mm; }
        .receipt { width: auto; max-width: none; margin: 0; padding: 0; border: 0; }
        .actions { display: none; }
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <header class="center">
        <img class="logo" src="/logo-bw.svg" alt="" width="42" height="42" />
        <h1>${escapeHtml(name)}</h1>
        ${settings.address ? `<p>${escapeHtml(settings.address)}</p>` : ""}
        ${settings.phoneDisplay ? `<p>Ph: ${escapeHtml(settings.phoneDisplay)}</p>` : ""}
      </header>
      <hr />
      <section class="meta">
        <div><span>Bill No</span><strong>${escapeHtml(bill.code)}</strong></div>
        <div><span>Date</span><span>${dateLabel(bill.createdAt)}, ${timeLabel(bill.createdAt)}</span></div>
        ${customer ? `<div><span>Customer</span><span>${escapeHtml(customer)}</span></div>` : ""}
      </section>
      <hr />
      <table>
        <thead>
          <tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="totals">
        <div><span>Total items</span><span>${bill.itemCount}</span></div>
        <div class="grand"><span>Grand Total</span><span>${escapeHtml(currency)}${amount(bill.total)}</span></div>
      </section>
      <hr />
      <p class="center thanks">Thank you! Visit again.</p>
    </main>
    <div class="actions">
      <button type="button" data-print>Print bill</button>
      <a href="/bill/${escapeHtml(bill.id)}.pdf" download>Download PDF</a>
    </div>
    <script src="/bill-print.js"></script>
  </body>
</html>`;
}

function sendPdf(res, bill, settings) {
  const width = 226.77; // 80 mm receipt
  const margin = 12;
  const content = width - margin * 2;
  const col = {
    item: { x: margin, w: 94 },
    qty: { x: margin + 94, w: 20 },
    rate: { x: margin + 114, w: 38 },
    amt: { x: margin + 152, w: content - 152 },
  };
  // Standard PDF fonts can't draw the rupee sign.
  const currency =
    !settings.currency || settings.currency === "₹" ? "Rs. " : settings.currency;
  const name = settings.bakeryName || "Royal Bite";
  const customer = customerLine(bill);

  const measure = new PDFDocument({ size: [width, 800] });
  measure.font("Helvetica").fontSize(8);
  const rowHeights = bill.items.map(
    (entry) => measure.heightOfString(entry.name, { width: col.item.w - 4 }) + 5,
  );
  const height =
    200 +
    (customer ? 12 : 0) +
    rowHeights.reduce((sum, value) => sum + value, 0) +
    90;

  const doc = new PDFDocument({
    size: [width, height],
    margins: { top: margin, bottom: 4, left: margin, right: margin },
    info: { Title: `Bill ${bill.code} · ${name}` },
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="bill-${bill.code}.pdf"`,
  );
  doc.pipe(res);
  doc.fillColor("#000").strokeColor("#000");

  const rule = (y, dashed) => {
    doc.save().lineWidth(dashed ? 0.6 : 0.8);
    if (dashed) doc.dash(2, { space: 2 });
    doc.moveTo(margin, y).lineTo(width - margin, y).stroke();
    doc.restore();
  };

  let y = margin;
  const logo = 30;
  doc.save().translate((width - logo) / 2, y).scale(logo / 64);
  doc.roundedRect(1.5, 1.5, 61, 61, 17).lineWidth(2.4).stroke();
  doc.path(LOGO_PATH).lineWidth(2.8).lineCap("round").lineJoin("round").stroke();
  doc.restore();
  y += logo + 6;

  doc.font("Helvetica-Bold").fontSize(13);
  doc.text(name.toUpperCase(), margin, y, {
    width: content,
    align: "center",
    characterSpacing: 1,
  });
  y = doc.y + 2;
  doc.font("Helvetica").fontSize(7.5);
  for (const line of [
    settings.address,
    settings.phoneDisplay ? `Ph: ${settings.phoneDisplay}` : "",
  ]) {
    if (!line) continue;
    doc.text(line, margin, y, { width: content, align: "center" });
    y = doc.y;
  }

  y += 7;
  rule(y, true);
  y += 7;

  doc.font("Helvetica").fontSize(8);
  const pair = (label, value, bold = false) => {
    doc.font("Helvetica").text(label, margin, y, { width: 60 });
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .text(value, margin + 60, y, { width: content - 60, align: "right" });
    y = doc.y + 2;
  };
  pair("Bill No", bill.code, true);
  pair("Date", `${dateLabel(bill.createdAt)}, ${timeLabel(bill.createdAt)}`);
  if (customer) pair("Customer", customer);

  y += 4;
  rule(y, true);
  y += 7;

  doc.font("Helvetica-Bold").fontSize(7.5);
  doc.text("ITEM", col.item.x, y, { width: col.item.w });
  doc.text("QTY", col.qty.x, y, { width: col.qty.w, align: "right" });
  doc.text("RATE", col.rate.x, y, { width: col.rate.w, align: "right" });
  doc.text("AMOUNT", col.amt.x, y, { width: col.amt.w, align: "right" });
  y += 11;
  rule(y, false);
  y += 5;

  doc.font("Helvetica").fontSize(8);
  bill.items.forEach((entry, index) => {
    doc.text(entry.name, col.item.x, y, { width: col.item.w - 4 });
    doc.text(String(entry.qty), col.qty.x, y, { width: col.qty.w, align: "right" });
    doc.text(amount(entry.price), col.rate.x, y, { width: col.rate.w, align: "right" });
    doc.text(amount(entry.lineTotal), col.amt.x, y, { width: col.amt.w, align: "right" });
    y += rowHeights[index];
  });

  rule(y, false);
  y += 6;
  doc.font("Helvetica").fontSize(8);
  doc.text("Total items", margin, y, { width: content / 2 });
  doc.text(String(bill.itemCount), margin + content / 2, y, {
    width: content / 2,
    align: "right",
  });
  y += 14;
  rule(y, false);
  y += 6;
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("GRAND TOTAL", margin, y, { width: content / 2 });
  doc.text(`${currency}${amount(bill.total)}`, margin + content / 2, y, {
    width: content / 2,
    align: "right",
  });
  y += 17;
  rule(y, false);
  y += 10;
  doc.font("Helvetica").fontSize(8);
  doc.text("Thank you! Visit again.", margin, y, {
    width: content,
    align: "center",
  });

  doc.end();
}

export default function printRoutes({ store, auth }) {
  const router = express.Router();

  router.get("/:file", async (req, res, next) => {
    try {
      if (!auth.isAuthed(req)) {
        return res.redirect(302, "/admin");
      }
      const file = String(req.params.file);
      const isPdf = file.endsWith(".pdf");
      const id = isPdf ? file.slice(0, -4) : file;
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        throw new ApiError(404, "Bill not found.");
      }
      const bill = await store.findBill(id);
      if (!bill) {
        throw new ApiError(404, "Bill not found.");
      }
      const settings = await store.getSettings();
      res.setHeader("Cache-Control", "no-store");
      if (isPdf) return sendPdf(res, bill, settings);
      return res.type("html").send(renderHtml(bill, settings));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
