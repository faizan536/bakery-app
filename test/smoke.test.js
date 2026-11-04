import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { addDaysStr, todayStr, weekdayOf } from "../lib/util.js";
import { createApp } from "../server.js";

test("bakery app end-to-end", async (t) => {
  const dataDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "bakery-test-"),
  );
  const { app, close } = await createApp({
    dataDir,
    adminPassword: "secret-pass",
    sessionSecret: "test-session-secret",
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await close();
    await fs.promises.rm(dataDir, { recursive: true, force: true });
  });

  async function request(url, { method = "GET", body, cookie } = {}) {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    const response = await fetch(`${base}${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return {
      status: response.status,
      headers: response.headers,
      json,
      text,
      setCookie: response.headers.getSetCookie?.() || [],
    };
  }

  let settings;
  let menu;
  let mawaCake;
  let khari;
  let pickupDate;
  let cakeDate;
  let orderCode;
  let cookie;

  await t.test("storefront pages and bootstrap load", async () => {
    const home = await request("/");
    assert.equal(home.status, 200);
    assert.match(home.text, /Fresh bakes/);

    const admin = await request("/admin");
    assert.equal(admin.status, 200);
    assert.match(admin.text, /Sign in/);

    const headers = await fetch(`${base}/`);
    assert.match(
      headers.headers.get("content-security-policy") || "",
      /default-src 'self'/,
    );

    const boot = await request("/api/bootstrap");
    assert.equal(boot.status, 200);
    settings = boot.json.settings;
    menu = boot.json.menu;
    assert.equal(settings.bakeryName, "Royal Bite");
    assert.equal(menu.length, 32);
    mawaCake = menu.find((item) => item.id === "slice-mawa");
    khari = menu.find((item) => item.id === "khari-maska");
    assert.ok(mawaCake && khari);
    assert.equal(mawaCake.available, true);

    pickupDate = addDaysStr(todayStr(), 1);
    while (settings.closedWeekdays.includes(weekdayOf(pickupDate))) {
      pickupDate = addDaysStr(pickupDate, 1);
    }
    cakeDate = addDaysStr(todayStr(), 3);
    while (settings.closedWeekdays.includes(weekdayOf(cakeDate))) {
      cakeDate = addDaysStr(cakeDate, 1);
    }
  });

  await t.test("pickup order is validated and created", async () => {
    const bad = await request("/api/orders", {
      method: "POST",
      body: {
        name: "X",
        phone: "123",
        items: [{ id: mawaCake.id, qty: 1 }],
        pickupDate,
        slot: settings.slots[0],
      },
    });
    assert.equal(bad.status, 400);

    const order = await request("/api/orders", {
      method: "POST",
      body: {
        name: "Faizan Test",
        phone: "+91 98765 43210",
        items: [
          { id: mawaCake.id, qty: 2 },
          { id: khari.id, qty: 1 },
        ],
        pickupDate,
        slot: settings.slots[0],
        notes: "Slice the cake, please.",
      },
    });
    assert.equal(order.status, 201, order.text);
    assert.equal(order.json.order.total, 380);
    assert.equal(order.json.order.status, "new");
    assert.equal(order.json.loyalty.stamps, 0);
    orderCode = order.json.order.code;
    assert.match(orderCode, /^RB-\d+$/);
  });

  await t.test("custom cake request with reference image", async () => {
    const image = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(300, 0),
    ]);
    const cake = await request("/api/orders", {
      method: "POST",
      body: {
        name: "Rhea Cake",
        phone: "9876500000",
        items: [],
        cakeDescription: "Chocolate birthday cake for 12 people.",
        referenceImage: `data:image/png;base64,${image.toString("base64")}`,
        pickupDate: cakeDate,
        slot: settings.slots[1],
      },
    });
    assert.equal(cake.status, 201, cake.text);
    assert.equal(cake.json.order.total, 0);
    assert.match(cake.json.order.cake.referenceImage, /^\/api\/uploads\//);
    const stored = await fetch(`${base}${cake.json.order.cake.referenceImage}`);
    assert.equal(stored.status, 200);
    assert.equal(stored.headers.get("content-type"), "image/png");
    assert.equal(Buffer.from(await stored.arrayBuffer()).length, image.length);

    const tooSoon = await request("/api/orders", {
      method: "POST",
      body: {
        name: "Rhea Cake",
        phone: "9876500000",
        items: [],
        cakeDescription: "A last-minute cake request.",
        pickupDate,
        slot: settings.slots[1],
      },
    });
    assert.equal(tooSoon.status, 400);
    assert.match(tooSoon.json.error, /48 hours/);
  });

  await t.test("admin authentication", async () => {
    const denied = await request("/api/admin/orders");
    assert.equal(denied.status, 401);

    const wrong = await request("/api/admin/login", {
      method: "POST",
      body: { password: "wrong-password" },
    });
    assert.equal(wrong.status, 401);

    const login = await request("/api/admin/login", {
      method: "POST",
      body: { password: "secret-pass" },
    });
    assert.equal(login.status, 200);
    assert.ok(login.setCookie.length > 0);
    cookie = login.setCookie[0].split(";")[0];
    assert.match(cookie, /^gc_admin=/);

    const session = await request("/api/admin/session", { cookie });
    assert.equal(session.json.authenticated, true);

    const orders = await request("/api/admin/orders", { cookie });
    assert.equal(orders.status, 200);
    assert.equal(orders.json.orders.length, 2);
  });

  await t.test("order status, loyalty stamps, and rewards", async () => {
    const adminOrders = await request("/api/admin/orders", { cookie });
    const first = adminOrders.json.orders.find(
      (order) => order.code === orderCode,
    );
    assert.ok(first);

    const ready = await request(`/api/admin/orders/${first.id}`, {
      method: "PATCH",
      cookie,
      body: { status: "ready" },
    });
    assert.equal(ready.status, 200);
    assert.equal(ready.json.order.status, "ready");

    const done = await request(`/api/admin/orders/${first.id}`, {
      method: "PATCH",
      cookie,
      body: { status: "completed" },
    });
    assert.equal(done.status, 200);
    assert.equal(done.json.order.status, "completed");

    const loyalty = await request("/api/loyalty?phone=919876543210");
    assert.equal(loyalty.status, 200);
    assert.equal(loyalty.json.found, true);
    assert.equal(loyalty.json.stamps, 1);
    assert.equal(loyalty.json.name, "Faizan T.");

    const reverse = await request(`/api/admin/orders/${first.id}`, {
      method: "PATCH",
      cookie,
      body: { status: "ready" },
    });
    assert.equal(reverse.status, 409);

    const newCodes = [];
    for (let index = 0; index < 9; index += 1) {
      const order = await request("/api/orders", {
        method: "POST",
        body: {
          name: "Faizan Test",
          phone: "919876543210",
          items: [{ id: khari.id, qty: 1 }],
          pickupDate,
          slot: settings.slots[0],
        },
      });
      assert.equal(order.status, 201, order.text);
      newCodes.push(order.json.order.code);
    }

    const all = await request("/api/admin/orders", { cookie });
    for (const code of newCodes) {
      const record = all.json.orders.find((order) => order.code === code);
      assert.ok(record);
      const readyOrder = await request(`/api/admin/orders/${record.id}`, {
        method: "PATCH",
        cookie,
        body: { status: "ready" },
      });
      assert.equal(readyOrder.status, 200);
      const completedOrder = await request(`/api/admin/orders/${record.id}`, {
        method: "PATCH",
        cookie,
        body: { status: "completed" },
      });
      assert.equal(completedOrder.status, 200);
    }

    const tenStamps = await request("/api/loyalty?phone=919876543210");
    assert.equal(tenStamps.json.stamps, 10);
    assert.equal(tenStamps.json.rewardsReady, 1);

    const customers = await request("/api/admin/customers", { cookie });
    assert.equal(customers.status, 200);
    const customer = customers.json.customers.find(
      (entry) => entry.phone === "919876543210",
    );
    assert.ok(customer);
    assert.equal(customer.orders, 10);
    assert.equal(customer.totalSpent, 1100);
    assert.equal(customer.rewardsReady, 1);

    const redeem = await request(
      `/api/admin/customers/${customer.phone}/redeem`,
      { method: "POST", cookie },
    );
    assert.equal(redeem.status, 200);
    assert.equal(redeem.json.loyalty.stamps, 0);
    assert.equal(redeem.json.loyalty.rewardsRedeemed, 1);

    const nothingToRedeem = await request(
      `/api/admin/customers/${customer.phone}/redeem`,
      { method: "POST", cookie },
    );
    assert.equal(nothingToRedeem.status, 400);

    const summary = await request("/api/admin/summary", { cookie });
    assert.equal(summary.json.counts.completed, 10);
    assert.equal(summary.json.counts.new, 1);
    assert.equal(summary.json.stats.revenueToday, 1100);
  });

  await t.test("menu availability, add, and delete", async () => {
    const soldOut = await request(`/api/admin/menu/${mawaCake.id}`, {
      method: "PATCH",
      cookie,
      body: { available: false },
    });
    assert.equal(soldOut.status, 200);
    assert.equal(soldOut.json.item.available, false);

    const boot = await request("/api/bootstrap");
    const publicSourdough = boot.json.menu.find(
      (item) => item.id === mawaCake.id,
    );
    assert.equal(publicSourdough.available, false);

    const rejected = await request("/api/orders", {
      method: "POST",
      body: {
        name: "Faizan Test",
        phone: "919876543210",
        items: [{ id: mawaCake.id, qty: 1 }],
        pickupDate,
        slot: settings.slots[0],
      },
    });
    assert.equal(rejected.status, 400);

    await request(`/api/admin/menu/${mawaCake.id}`, {
      method: "PATCH",
      cookie,
      body: { available: true },
    });

    const created = await request("/api/admin/menu", {
      method: "POST",
      cookie,
      body: {
        name: "Test Cardamom Bun",
        category: "Pastries",
        price: 99,
        description: "A test item.",
        tag: "Test",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.item.price, 99);

    const removed = await request(`/api/admin/menu/${created.json.item.id}`, {
      method: "DELETE",
      cookie,
    });
    assert.equal(removed.status, 200);
  });

  await t.test("bills: create, list, and print", async () => {
    const item = menu[0];
    const created = await request("/api/admin/bills", {
      method: "POST",
      cookie,
      body: {
        items: [
          {
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            qty: 2,
          },
        ],
        total: item.price * 2,
        itemCount: 2,
        customerName: "Bill Tester",
        customerPhone: "919876543210",
      },
    });
    assert.equal(created.status, 201, created.text);
    assert.match(created.json.bill.code, /^RB-\d+$/);
    assert.equal(created.json.bill.total, item.price * 2);
    assert.equal(created.json.bill.itemCount, 2);
    assert.equal(created.json.bill.customerName, "Bill Tester");

    const listed = await request("/api/admin/bills", { cookie });
    assert.equal(listed.status, 200);
    assert.ok(listed.json.bills.some((bill) => bill.code === created.json.bill.code));

    const printed = await request(`/bill/${created.json.bill.id}`, {
      cookie,
    });
    assert.equal(printed.status, 200);
    assert.match(printed.headers.get("content-type") || "", /text\/html/);
    const html = printed.text;
    assert.match(html, /Royal Bite/);
    const expectedName = item.name
      .replace(/&/g, "&amp;")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(html, new RegExp(expectedName));
    assert.match(html, /bill-print\.js/);
    assert.doesNotMatch(html, /onclick=/);

    const pdf = await fetch(`${base}/bill/${created.json.bill.id}.pdf`, {
      headers: { cookie },
    });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    const pdfBytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(pdfBytes.subarray(0, 5).toString(), "%PDF-");

    const anonymous = await fetch(`${base}/bill/${created.json.bill.id}`, {
      redirect: "manual",
    });
    assert.equal(anonymous.status, 302);
  });

  await t.test("settings validation and updates", async () => {
    const invalid = await request("/api/admin/settings", {
      method: "PATCH",
      cookie,
      body: { slots: [] },
    });
    assert.equal(invalid.status, 400);

    const invalidDays = await request("/api/admin/settings", {
      method: "PATCH",
      cookie,
      body: { closedWeekdays: [9] },
    });
    assert.equal(invalidDays.status, 400);

    const updated = await request("/api/admin/settings", {
      method: "PATCH",
      cookie,
      body: { notice: "Cake orders are confirmed on WhatsApp." },
    });
    assert.equal(updated.status, 200);
    assert.equal(
      updated.json.settings.notice,
      "Cake orders are confirmed on WhatsApp.",
    );

    const boot = await request("/api/bootstrap");
    assert.equal(
      boot.json.settings.notice,
      "Cake orders are confirmed on WhatsApp.",
    );
  });

  await t.test("logout clears the session cookie", async () => {
    const logout = await request("/api/admin/logout", {
      method: "POST",
      cookie,
    });
    assert.equal(logout.status, 200);
    assert.ok(
      logout.setCookie.some((value) => value.includes("Max-Age=0")),
      "logout should expire the cookie",
    );

    const noCookie = await request("/api/admin/orders");
    assert.equal(noCookie.status, 401);
  });
});
