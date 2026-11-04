import crypto from "node:crypto";
import { sql } from "@vercel/postgres";
import { formatLocalDate, round2, todayStr } from "./util.js";
import { initSchema } from "./db.js";

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await initSchema();
    initialized = true;
  }
}

function rowToObject(row) {
  return row;
}

export class Store {
  constructor() {
    this.uploadDir = null; // no local filesystem on Vercel; images served via Blob
  }

  async init() {
    await ensureInit();
    await this.ensureDefaults();
  }

  async ensureDefaults() {
    const existing = await sql`SELECT value FROM settings WHERE key = 'settings'`;
    if (existing.rows.length === 0) {
      const defaults = await import("./seed.js");
      await sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify(defaults.seedDb().settings)})`;
      for (const item of defaults.seedDb().menu) {
        await sql`INSERT INTO menu (id, name, category, description, price, available, tag)
          VALUES (${item.id}, ${item.name}, ${item.category}, ${item.description}, ${item.price}, ${item.available}, ${item.tag})`;
      }
      await sql`INSERT INTO counters (name, value) VALUES ('order', 1000), ('bill', 1000) ON CONFLICT (name) DO NOTHING`;
    }
  }

  async getSecret() {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    const secret = crypto.randomBytes(32).toString("hex");
    return secret;
  }

  async getSettingsFromDb() {
    await ensureInit();
    const res = await sql`SELECT value FROM settings WHERE key = 'settings'`;
    if (res.rows.length === 0) return {};
    return res.rows[0].value;
  }

  async updateSettings(patch) {
    await ensureInit();
    const current = await this.getSettingsFromDb();
    const merged = { ...current, ...patch };
    await sql`UPDATE settings SET value = ${JSON.stringify(merged)} WHERE key = 'settings'`;
    return merged;
  }

  async getMenu(includeUnavailable = false) {
    await ensureInit();
    let q = sql`SELECT id, name, category, description, price, available, tag FROM menu`;
    if (!includeUnavailable) {
      q = sql`SELECT id, name, category, description, price, available, tag FROM menu WHERE available = TRUE`;
    }
    const res = await q;
    return res.rows.map((row) => ({ ...row, price: Number(row.price) }));
  }

  async addMenuItem(fields) {
    await ensureInit();
    const id = crypto.randomUUID();
    await sql`INSERT INTO menu (id, name, category, description, price, available, tag)
      VALUES (${id}, ${fields.name}, ${fields.category}, ${fields.description || ""}, ${fields.price}, ${fields.available !== false}, ${fields.tag || ""})`;
    return {
      id,
      name: fields.name,
      category: fields.category,
      description: fields.description || "",
      price: fields.price,
      available: fields.available !== false,
      tag: fields.tag || "",
    };
  }

  async updateMenuItem(id, patch) {
    await ensureInit();
    if ("name" in patch) await sql`UPDATE menu SET name = ${patch.name} WHERE id = ${id}`;
    if ("category" in patch) await sql`UPDATE menu SET category = ${patch.category} WHERE id = ${id}`;
    if ("description" in patch) await sql`UPDATE menu SET description = ${patch.description} WHERE id = ${id}`;
    if ("price" in patch) await sql`UPDATE menu SET price = ${patch.price} WHERE id = ${id}`;
    if ("available" in patch) await sql`UPDATE menu SET available = ${patch.available} WHERE id = ${id}`;
    if ("tag" in patch) await sql`UPDATE menu SET tag = ${patch.tag} WHERE id = ${id}`;

    const res = await sql`SELECT * FROM menu WHERE id = ${id}`;
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      price: Number(row.price),
      available: row.available,
      tag: row.tag,
    };
  }

  async deleteMenuItem(id) {
    await ensureInit();
    const res = await sql`DELETE FROM menu WHERE id = ${id}`;
    return res.rowCount > 0;
  }

  async createOrder(fields) {
    await ensureInit();
    const counter = await sql`UPDATE counters SET value = value + 1 WHERE name = 'order' RETURNING value`;
    const orderNum = counter.rows[0].value;
    const now = new Date().toISOString();
    const settings = await this.getSettingsFromDb();
    const prefix = settings.orderPrefix || "RB";
    const id = crypto.randomUUID();
    const order = {
      id,
      code: `${prefix}-${orderNum}`,
      customer: fields.customer,
      items: fields.items,
      total: fields.total,
      pickupDate: fields.pickupDate,
      slot: fields.slot,
      notes: fields.notes || "",
      cake: fields.cake || null,
      status: "new",
      stampAwarded: false,
      createdAt: now,
      updatedAt: now,
      history: [{ status: "new", at: now }],
    };
    await sql`INSERT INTO orders (id, code, customer, items, total, pickup_date, slot, notes, cake, status, stamp_awarded, created_at, updated_at)
      VALUES (${id}, ${order.code}, ${JSON.stringify(order.customer)}, ${JSON.stringify(order.items)}, ${order.total}, ${order.pickupDate}, ${order.slot}, ${order.notes}, ${order.cake ? JSON.stringify(order.cake) : null}, ${order.status}, ${order.stampAwarded}, ${order.createdAt}, ${order.updatedAt})`;
    return structuredClone(order);
  }

  findOrder(id) {
    throw new Error("use findOrderFromDb");
  }

  async findOrderFromDb(id) {
    await ensureInit();
    const res = await sql`SELECT * FROM orders WHERE id = ${id}`;
    if (res.rows.length === 0) return null;
    return this.orderFromRow(res.rows[0]);
  }

  listOrders(status) {
    throw new Error("use listOrdersFromDb");
  }

  async listOrdersFromDb(status) {
    await ensureInit();
    let q = sql`SELECT * FROM orders`;
    if (status) {
      q = sql`SELECT * FROM orders WHERE status = ${status}`;
    }
    q = sql`${q} ORDER BY created_at DESC`;
    const res = await q;
    return res.rows.map((row) => this.orderFromRow(row));
  }

  orderFromRow(row) {
    return {
      id: row.id,
      code: row.code,
      customer: row.customer,
      items: row.items,
      total: Number(row.total),
      pickupDate: row.pickup_date,
      slot: row.slot,
      notes: row.notes,
      cake: row.cake,
      status: row.status,
      stampAwarded: row.stamp_awarded,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      history: row.history || [{ status: row.status, at: row.created_at }],
    };
  }

  async updateOrderStatus(id, status) {
    await ensureInit();
    const order = await this.findOrderFromDb(id);
    if (!order) return null;
    if (order.status === status) return structuredClone(order);

    const now = new Date().toISOString();
    const history = [...(order.history || []), { status, at: now }];
    await sql`UPDATE orders SET status = ${status}, updated_at = ${now}, history = ${JSON.stringify(history)} WHERE id = ${id}`;

    let updated = structuredClone(order);
    updated.status = status;
    updated.updatedAt = now;
    updated.history = history;

    if (status === "completed" && !order.stampAwarded) {
      const phone = order.customer.phone;
      await this.awardStamp(phone, order.customer.name);
      updated.stampAwarded = true;
    }

    return updated;
  }

  async awardStamp(phone, name) {
    await ensureInit();
    const existing = await sql`SELECT * FROM loyalty WHERE phone = ${phone}`;
    if (existing.rows.length === 0) {
      await sql`INSERT INTO loyalty (phone, stamps, rewards_redeemed, name, updated_at)
        VALUES (${phone}, 1, 0, ${name}, ${new Date().toISOString()})`;
    } else {
      const rec = existing.rows[0];
      await sql`UPDATE loyalty SET stamps = ${(rec.stamps || 0) + 1}, name = ${name}, updated_at = ${new Date().toISOString()} WHERE phone = ${phone}`;
    }
  }

  getLoyalty(phone) {
    throw new Error("use getLoyaltyFromDb");
  }

  async getLoyaltyFromDb(phone) {
    await ensureInit();
    const settings = await this.getSettingsFromDb();
    const target = settings.loyaltyTarget || 10;
    const res = await sql`SELECT * FROM loyalty WHERE phone = ${phone}`;
    if (res.rows.length === 0) {
      return { found: false, name: "", stamps: 0, target, rewardsReady: 0, rewardsRedeemed: 0 };
    }
    const rec = res.rows[0];
    const stamps = rec.stamps || 0;
    return {
      found: true,
      name: rec.name || "",
      stamps,
      target,
      rewardsReady: Math.floor(stamps / target),
      rewardsRedeemed: rec.rewards_redeemed || 0,
    };
  }

  async redeemReward(phone) {
    await ensureInit();
    const settings = await this.getSettingsFromDb();
    const target = settings.loyaltyTarget || 10;
    const res = await sql`SELECT * FROM loyalty WHERE phone = ${phone}`;
    if (res.rows.length === 0 || (res.rows[0].stamps || 0) < target) return null;
    const rec = res.rows[0];
    await sql`UPDATE loyalty SET stamps = ${(rec.stamps || 0) - target}, rewards_redeemed = ${(rec.rewards_redeemed || 0) + 1}, updated_at = ${new Date().toISOString()} WHERE phone = ${phone}`;
    return this.getLoyaltyFromDb(phone);
  }

  listCustomers() {
    throw new Error("use listCustomersFromDb");
  }

  async listCustomersFromDb() {
    await ensureInit();
    const settings = await this.getSettingsFromDb();
    const target = settings.loyaltyTarget || 10;
    const orders = await this.listOrdersFromDb(null);
    const customers = new Map();

    for (const order of orders) {
      if (order.status === "cancelled") continue;
      const phone = order.customer.phone;
      if (!customers.has(phone)) {
        customers.set(phone, {
          name: order.customer.name,
          phone,
          orders: 0,
          totalSpent: 0,
          lastOrderAt: order.createdAt,
          lastPickupDate: order.pickupDate,
          stamps: 0,
          target,
          rewardsRedeemed: 0,
          rewardsReady: 0,
        });
      }
      const c = customers.get(phone);
      c.orders += 1;
      c.totalSpent = round2(c.totalSpent + order.total);
      if (order.createdAt > c.lastOrderAt) {
        c.lastOrderAt = order.createdAt;
        c.name = order.customer.name;
      }
      if (order.pickupDate > c.lastPickupDate) {
        c.lastPickupDate = order.pickupDate;
      }
    }

    // attach loyalty stamps
    for (const [phone, c] of customers) {
      const loyalty = await this.getLoyaltyFromDb(phone);
      c.stamps = loyalty.stamps;
      c.rewardsReady = loyalty.rewardsReady;
      c.rewardsRedeemed = loyalty.rewardsRedeemed;
    }

    return [...customers.values()].sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
  }

  getSummary() {
    throw new Error("use getSummaryFromDb");
  }

  async getSummaryFromDb() {
    await ensureInit();
    const today = todayStr();
    const counts = { new: 0, ready: 0, completed: 0, cancelled: 0 };
    let ordersToday = 0;
    let revenueToday = 0;
    let pickupsToday = 0;

    const orders = await this.listOrdersFromDb(null);
    for (const order of orders) {
      if (order.status in counts) counts[order.status] += 1;
      const createdOn = formatLocalDate(new Date(order.createdAt));
      if (createdOn === today && order.status !== "cancelled") {
        ordersToday += 1;
        revenueToday += order.total || 0;
      }
      if (order.pickupDate === today && order.status !== "cancelled" && order.status !== "completed") {
        pickupsToday += 1;
      }
    }

    return {
      counts,
      stats: {
        ordersToday,
        revenueToday: round2(revenueToday),
        pending: counts.new + counts.ready,
        pickupsToday,
      },
    };
  }

  async createBill(fields) {
    await ensureInit();
    const counter = await sql`UPDATE counters SET value = value + 1 WHERE name = 'bill' RETURNING value`;
    const billNum = counter.rows[0].value;
    const settings = await this.getSettingsFromDb();
    const prefix = settings.orderPrefix || "RB";
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const items = (Array.isArray(fields.items) ? fields.items : []).map((entry) => {
      const price = Number(entry.price || 0);
      const qty = Math.max(1, Number(entry.qty || 1));
      return {
        menuItemId: entry.menuItemId || null,
        name: String(entry.name || "").slice(0, 100),
        category: String(entry.category || "").slice(0, 60),
        price: round2(price),
        qty,
        lineTotal: round2(price * qty),
      };
    });

    if (items.length === 0) {
      const err = new Error("Add at least one item to the bill.");
      err.status = 400;
      throw err;
    }

    const itemCount = items.reduce((sum, entry) => sum + entry.qty, 0);
    const total = round2(items.reduce((sum, entry) => sum + entry.lineTotal, 0));

    const bill = {
      id,
      code: `${prefix}-${billNum}`,
      date: todayStr(),
      items,
      total,
      itemCount,
      customerName: fields.customerName || "",
      customerPhone: fields.customerPhone || "",
      createdAt: now,
    };

    await sql`INSERT INTO bills (id, code, date, items, total, item_count, customer_name, customer_phone, created_at)
      VALUES (${id}, ${bill.code}, ${bill.date}, ${JSON.stringify(items)}, ${total}, ${itemCount}, ${bill.customerName}, ${bill.customerPhone}, ${now})`;

    return structuredClone(bill);
  }

  listBills() {
    throw new Error("use listBillsFromDb");
  }

  async listBillsFromDb() {
    await ensureInit();
    const res = await sql`SELECT * FROM bills ORDER BY created_at DESC`;
    return res.rows.map((row) => ({
      id: row.id,
      code: row.code,
      date: row.date,
      items: row.items,
      total: Number(row.total),
      itemCount: row.item_count,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      createdAt: row.created_at,
    }));
  }

  findBill(id) {
    throw new Error("use findBillFromDb");
  }

  async findBillFromDb(id) {
    await ensureInit();
    const res = await sql`SELECT * FROM bills WHERE id = ${id}`;
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      code: row.code,
      date: row.date,
      items: row.items,
      total: Number(row.total),
      itemCount: row.item_count,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      createdAt: row.created_at,
    };
  }
}
