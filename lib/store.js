import crypto from "node:crypto";
import { seedDb } from "./seed.js";
import { formatLocalDate, round2, todayStr } from "./util.js";

function slugify(value) {
  return (
    String(value || "item")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item"
  );
}

const json = (value) => JSON.stringify(value);

export class Store {
  constructor(db) {
    this.db = db;
  }

  async init() {
    const seed = seedDb();
    const inserted = await this.db.query(
      `INSERT INTO rb_kv (key, value) VALUES ('settings', $1::jsonb)
       ON CONFLICT (key) DO NOTHING RETURNING key`,
      [json(seed.settings)],
    );
    if (inserted.rowCount > 0) {
      let position = 0;
      for (const item of seed.menu) {
        position += 1;
        await this.db.query(
          `INSERT INTO rb_menu (id, position, data) VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [item.id, position, json(item)],
        );
      }
    }
  }

  async getSessionSecret() {
    await this.db.query(
      `INSERT INTO rb_kv (key, value) VALUES ('session_secret', $1::jsonb)
       ON CONFLICT (key) DO NOTHING`,
      [json(crypto.randomBytes(32).toString("hex"))],
    );
    const result = await this.db.query(
      `SELECT value FROM rb_kv WHERE key = 'session_secret'`,
    );
    return result.rows[0].value;
  }

  async nextNumber(name) {
    const result = await this.db.query(
      `INSERT INTO rb_counters (name, value) VALUES ($1, 1001)
       ON CONFLICT (name) DO UPDATE SET value = rb_counters.value + 1
       RETURNING value`,
      [name],
    );
    return Number(result.rows[0].value);
  }

  // ---------- settings ----------

  async getSettings() {
    const result = await this.db.query(
      `SELECT value FROM rb_kv WHERE key = 'settings'`,
    );
    return { ...seedDb().settings, ...(result.rows[0]?.value || {}) };
  }

  async updateSettings(patch) {
    const merged = { ...(await this.getSettings()), ...patch };
    await this.db.query(
      `INSERT INTO rb_kv (key, value) VALUES ('settings', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [json(merged)],
    );
    return merged;
  }

  // ---------- menu ----------

  async getMenu(includeUnavailable = false) {
    const result = await this.db.query(
      `SELECT data FROM rb_menu ORDER BY position, id`,
    );
    const menu = result.rows.map((row) => ({
      ...row.data,
      price: Number(row.data.price),
    }));
    return includeUnavailable ? menu : menu.filter((item) => item.available);
  }

  async addMenuItem(fields) {
    const item = {
      id: `${slugify(fields.name)}-${crypto.randomBytes(3).toString("hex")}`,
      name: fields.name,
      category: fields.category,
      description: fields.description || "",
      price: fields.price,
      available: fields.available !== false,
      tag: fields.tag || "",
    };
    await this.db.query(
      `INSERT INTO rb_menu (id, position, data)
       VALUES ($1, (SELECT COALESCE(MAX(position), 0) + 1 FROM rb_menu), $2::jsonb)`,
      [item.id, json(item)],
    );
    return item;
  }

  async updateMenuItem(id, patch) {
    const result = await this.db.query(
      `SELECT data FROM rb_menu WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    const item = { ...result.rows[0].data, ...patch, id };
    await this.db.query(`UPDATE rb_menu SET data = $2::jsonb WHERE id = $1`, [
      id,
      json(item),
    ]);
    return item;
  }

  async deleteMenuItem(id) {
    const result = await this.db.query(`DELETE FROM rb_menu WHERE id = $1`, [
      id,
    ]);
    return result.rowCount > 0;
  }

  // ---------- orders ----------

  async createOrder(fields) {
    const settings = await this.getSettings();
    const number = await this.nextNumber("order");
    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      code: `${settings.orderPrefix || "RB"}-${number}`,
      customer: fields.customer,
      items: fields.items,
      total: round2(fields.total),
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
    await this.db.query(
      `INSERT INTO rb_orders (id, code, status, created_at, data)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [order.id, order.code, order.status, order.createdAt, json(order)],
    );
    return order;
  }

  async findOrder(id) {
    const result = await this.db.query(
      `SELECT data FROM rb_orders WHERE id = $1`,
      [id],
    );
    return result.rows[0]?.data || null;
  }

  async findOrderByCode(code, phone) {
    const result = await this.db.query(
      `SELECT data FROM rb_orders WHERE lower(code) = lower($1)`,
      [code],
    );
    return (
      result.rows
        .map((row) => row.data)
        .find((order) => order.customer.phone === phone) || null
    );
  }

  async listOrders(status = null) {
    const result = status
      ? await this.db.query(
          `SELECT data FROM rb_orders WHERE status = $1 ORDER BY created_at DESC`,
          [status],
        )
      : await this.db.query(
          `SELECT data FROM rb_orders ORDER BY created_at DESC`,
        );
    return result.rows.map((row) => row.data);
  }

  async updateOrderStatus(id, status) {
    const order = await this.findOrder(id);
    if (!order) return null;
    if (order.status === status) return order;

    const now = new Date().toISOString();
    order.status = status;
    order.updatedAt = now;
    order.history = [...(order.history || []), { status, at: now }];

    if (status === "completed" && !order.stampAwarded) {
      await this.awardStamp(order.customer.phone, order.customer.name);
      order.stampAwarded = true;
    }

    await this.db.query(
      `UPDATE rb_orders SET status = $2, data = $3::jsonb WHERE id = $1`,
      [id, status, json(order)],
    );
    return order;
  }

  // ---------- loyalty ----------

  async readLoyalty(phone) {
    const result = await this.db.query(
      `SELECT data FROM rb_loyalty WHERE phone = $1`,
      [phone],
    );
    return result.rows[0]?.data || null;
  }

  async writeLoyalty(phone, record) {
    await this.db.query(
      `INSERT INTO rb_loyalty (phone, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (phone) DO UPDATE SET data = EXCLUDED.data`,
      [phone, json(record)],
    );
  }

  async awardStamp(phone, name) {
    const record = (await this.readLoyalty(phone)) || {
      name: "",
      stamps: 0,
      redeemed: 0,
    };
    record.stamps = (record.stamps || 0) + 1;
    record.name = name || record.name;
    record.updatedAt = new Date().toISOString();
    await this.writeLoyalty(phone, record);
  }

  async getLoyalty(phone) {
    const settings = await this.getSettings();
    const target = settings.loyaltyTarget || 10;
    const record = await this.readLoyalty(phone);
    if (!record) {
      return {
        found: false,
        name: "",
        stamps: 0,
        target,
        rewardsReady: 0,
        rewardsRedeemed: 0,
      };
    }
    const stamps = record.stamps || 0;
    return {
      found: true,
      name: record.name || "",
      stamps,
      target,
      rewardsReady: Math.floor(stamps / target),
      rewardsRedeemed: record.redeemed || 0,
    };
  }

  async redeemReward(phone) {
    const settings = await this.getSettings();
    const target = settings.loyaltyTarget || 10;
    const record = await this.readLoyalty(phone);
    if (!record || (record.stamps || 0) < target) return null;
    record.stamps -= target;
    record.redeemed = (record.redeemed || 0) + 1;
    record.updatedAt = new Date().toISOString();
    await this.writeLoyalty(phone, record);
    return this.getLoyalty(phone);
  }

  async listCustomers() {
    const settings = await this.getSettings();
    const target = settings.loyaltyTarget || 10;
    const orders = await this.listOrders();
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
          rewardsReady: 0,
          rewardsRedeemed: 0,
        });
      }
      const customer = customers.get(phone);
      customer.orders += 1;
      customer.totalSpent = round2(customer.totalSpent + (order.total || 0));
      if (order.createdAt > customer.lastOrderAt) {
        customer.lastOrderAt = order.createdAt;
        customer.name = order.customer.name;
      }
      if (order.pickupDate > customer.lastPickupDate) {
        customer.lastPickupDate = order.pickupDate;
      }
    }

    for (const [phone, customer] of customers) {
      const loyalty = await this.getLoyalty(phone);
      customer.stamps = loyalty.stamps;
      customer.rewardsReady = loyalty.rewardsReady;
      customer.rewardsRedeemed = loyalty.rewardsRedeemed;
    }

    return [...customers.values()].sort((a, b) =>
      b.lastOrderAt.localeCompare(a.lastOrderAt),
    );
  }

  async getSummary() {
    const today = todayStr();
    const counts = { new: 0, ready: 0, completed: 0, cancelled: 0 };
    let ordersToday = 0;
    let revenueToday = 0;
    let pickupsToday = 0;

    for (const order of await this.listOrders()) {
      if (order.status in counts) counts[order.status] += 1;
      const createdOn = formatLocalDate(new Date(order.createdAt));
      if (createdOn === today && order.status !== "cancelled") {
        ordersToday += 1;
        revenueToday += order.total || 0;
      }
      if (
        order.pickupDate === today &&
        order.status !== "cancelled" &&
        order.status !== "completed"
      ) {
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

  // ---------- bills ----------

  async createBill(fields) {
    const items = (Array.isArray(fields.items) ? fields.items : []).map(
      (entry) => {
        const price = round2(Number(entry.price || 0));
        const qty = Math.max(1, Math.floor(Number(entry.qty || 1)));
        return {
          menuItemId: entry.menuItemId || entry.id || null,
          name: String(entry.name || "").slice(0, 100),
          category: String(entry.category || "").slice(0, 60),
          price,
          qty,
          lineTotal: round2(price * qty),
        };
      },
    );
    const settings = await this.getSettings();
    const number = await this.nextNumber("bill");
    const now = new Date().toISOString();
    const bill = {
      id: crypto.randomUUID(),
      code: `${settings.orderPrefix || "RB"}-${number}`,
      date: todayStr(),
      items,
      total: round2(items.reduce((sum, entry) => sum + entry.lineTotal, 0)),
      itemCount: items.reduce((sum, entry) => sum + entry.qty, 0),
      customerName: fields.customerName || "",
      customerPhone: fields.customerPhone || "",
      createdAt: now,
    };
    await this.db.query(
      `INSERT INTO rb_bills (id, code, created_at, data) VALUES ($1, $2, $3, $4::jsonb)`,
      [bill.id, bill.code, bill.createdAt, json(bill)],
    );
    return bill;
  }

  async listBills(limit = 200) {
    const result = await this.db.query(
      `SELECT data FROM rb_bills ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => row.data);
  }

  async findBill(id) {
    const result = await this.db.query(
      `SELECT data FROM rb_bills WHERE id = $1`,
      [id],
    );
    return result.rows[0]?.data || null;
  }

  // ---------- uploads (cake reference photos) ----------

  async saveUpload(buffer, extension) {
    const mime =
      { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[extension] ||
      "application/octet-stream";
    const id = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${extension}`;
    await this.db.query(
      `INSERT INTO rb_uploads (id, mime, bytes, created_at) VALUES ($1, $2, $3, $4)`,
      [id, mime, buffer, new Date().toISOString()],
    );
    return `/api/uploads/${id}`;
  }

  async getUpload(id) {
    const result = await this.db.query(
      `SELECT mime, bytes FROM rb_uploads WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return {
      mime: result.rows[0].mime,
      bytes: Buffer.from(result.rows[0].bytes),
    };
  }
}
