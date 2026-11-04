import express from "express";
import {
  ApiError,
  bool,
  integer,
  money,
  normalizeInstagram,
  normalizePhone,
  optionalStr,
  str,
} from "../lib/util.js";

const ORDER_STATUSES = ["new", "ready", "completed", "cancelled"];
const TRANSITIONS = {
  new: ["ready", "cancelled"],
  ready: ["completed", "new", "cancelled"],
  completed: [],
  cancelled: ["new"],
};

function menuFields(body) {
  const patch = {};
  if ("name" in body) {
    patch.name = str(body.name, { label: "Item name", min: 2, max: 80 });
  }
  if ("category" in body) {
    patch.category = str(body.category, {
      label: "Category",
      min: 2,
      max: 40,
    });
  }
  if ("description" in body) {
    patch.description = optionalStr(body.description, {
      label: "Description",
      max: 300,
    });
  }
  if ("price" in body) {
    patch.price = money(body.price, { label: "Price" });
  }
  if ("available" in body) {
    patch.available = bool(body.available, { label: "Availability" });
  }
  if ("tag" in body) {
    patch.tag = optionalStr(body.tag, { label: "Tag", max: 24 });
  }
  return patch;
}

function settingsFields(body) {
  const patch = {};
  if ("bakeryName" in body) {
    patch.bakeryName = str(body.bakeryName, {
      label: "Bakery name",
      min: 2,
      max: 60,
    });
  }
  if ("tagline" in body) {
    patch.tagline = str(body.tagline, {
      label: "Tagline",
      min: 2,
      max: 160,
    });
  }
  if ("story" in body) {
    patch.story = str(body.story, { label: "Story", min: 2, max: 600 });
  }
  if ("address" in body) {
    patch.address = str(body.address, {
      label: "Address",
      min: 2,
      max: 200,
    });
  }
  if ("phoneDisplay" in body) {
    patch.phoneDisplay = str(body.phoneDisplay, {
      label: "Phone number",
      min: 2,
      max: 40,
    });
  }
  if ("whatsapp" in body) {
    patch.whatsapp = normalizePhone(body.whatsapp);
  }
  if ("instagram" in body) {
    patch.instagram = normalizeInstagram(body.instagram);
  }
  if ("countryCode" in body) {
    const code = str(body.countryCode, {
      label: "Country code",
      min: 1,
      max: 4,
    });
    if (!/^\d{1,4}$/.test(code)) {
      throw new ApiError(400, "Country code must be 1 to 4 digits.");
    }
    patch.countryCode = code;
  }
  if ("currency" in body) {
    patch.currency = str(body.currency, {
      label: "Currency symbol",
      min: 1,
      max: 4,
    });
  }
  if ("orderPrefix" in body) {
    const prefix = str(body.orderPrefix, {
      label: "Order prefix",
      min: 1,
      max: 4,
    }).toUpperCase();
    if (!/^[A-Z0-9]{1,4}$/.test(prefix)) {
      throw new ApiError(
        400,
        "Order prefix can only contain letters and numbers (max 4).",
      );
    }
    patch.orderPrefix = prefix;
  }
  if ("slots" in body) {
    if (
      !Array.isArray(body.slots) ||
      body.slots.length < 1 ||
      body.slots.length > 12
    ) {
      throw new ApiError(400, "Add between 1 and 12 pickup slots.");
    }
    patch.slots = body.slots.map((slot) =>
      str(slot, { label: "Pickup slot", min: 1, max: 60 }),
    );
    if (new Set(patch.slots).size !== patch.slots.length) {
      throw new ApiError(400, "Pickup slots must be unique.");
    }
  }
  if ("closedWeekdays" in body) {
    if (!Array.isArray(body.closedWeekdays)) {
      throw new ApiError(400, "Closed days must be a list.");
    }
    const days = [
      ...new Set(
        body.closedWeekdays.map((day) =>
          integer(day, { label: "Closed weekday", min: 0, max: 6 }),
        ),
      ),
    ];
    patch.closedWeekdays = days;
  }
  if ("loyaltyTarget" in body) {
    patch.loyaltyTarget = integer(body.loyaltyTarget, {
      label: "Loyalty target",
      min: 2,
      max: 50,
    });
  }
  if ("loyaltyBlurb" in body) {
    patch.loyaltyBlurb = str(body.loyaltyBlurb, {
      label: "Loyalty blurb",
      min: 2,
      max: 240,
    });
  }
  if ("notice" in body) {
    patch.notice = optionalStr(body.notice, { label: "Notice", max: 300 });
  }
  if ("hours" in body) {
    if (
      !Array.isArray(body.hours) ||
      body.hours.length < 1 ||
      body.hours.length > 7
    ) {
      throw new ApiError(400, "Add between 1 and 7 opening-hours rows.");
    }
    patch.hours = body.hours.map((row) => {
      if (!row || typeof row !== "object") {
        throw new ApiError(400, "Opening hours rows were invalid.");
      }
      return {
        label: str(row.label, {
          label: "Hours label",
          min: 1,
          max: 40,
        }),
        value: str(row.value, {
          label: "Hours value",
          min: 1,
          max: 40,
        }),
      };
    });
  }
  return patch;
}

export default function adminRoutes({ store, auth }) {
  const router = express.Router();
  const loginAttempts = new Map();

  router.post("/login", (req, res) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let record = loginAttempts.get(key);
    if (record && record.reset <= now) {
      loginAttempts.delete(key);
      record = null;
    }
    if (record && record.count >= 10) {
      return res.status(429).json({
        error: "Too many sign-in attempts. Please try again in 15 minutes.",
      });
    }

    const password = req.body && req.body.password;
    if (!auth.checkPassword(password)) {
      if (!record) {
        record = { count: 0, reset: now + 15 * 60 * 1000 };
        loginAttempts.set(key, record);
      }
      record.count += 1;
      return res.status(401).json({ error: "Incorrect password." });
    }

    loginAttempts.delete(key);
    auth.setSessionCookie(req, res);
    return res.json({ ok: true });
  });

  router.post("/logout", (req, res) => {
    auth.clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get("/session", (req, res) => {
    res.json({ authenticated: auth.isAuthed(req) });
  });

  router.use(auth.requireAdmin);

  router.get("/summary", async (req, res, next) => {
    try {
      res.json(await store.getSummary());
    } catch (error) {
      next(error);
    }
  });

  router.get("/orders", async (req, res, next) => {
    try {
      const status = req.query.status;
      if (status && !ORDER_STATUSES.includes(status)) {
        throw new ApiError(400, "Unknown order status.");
      }
      res.json({ orders: await store.listOrders(status || null) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/orders/:id", async (req, res, next) => {
    try {
      const status = str(req.body?.status, {
        label: "Status",
        min: 1,
        max: 20,
      });
      if (!ORDER_STATUSES.includes(status)) {
        throw new ApiError(400, "Unknown order status.");
      }
      const order = await store.findOrder(req.params.id);
      if (!order) {
        throw new ApiError(404, "Order not found.");
      }
      if (order.status === status) {
        return res.json({ order });
      }
      if (!TRANSITIONS[order.status]?.includes(status)) {
        throw new ApiError(
          409,
          `An order that is "${order.status}" can't be marked "${status}".`,
        );
      }
      const updated = await store.updateOrderStatus(order.id, status);
      return res.json({ order: updated });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/menu", async (req, res, next) => {
    try {
      res.json({ menu: await store.getMenu(true) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/menu", async (req, res, next) => {
    try {
      const body = req.body || {};
      const fields = menuFields(body);
      if (!fields.name || !fields.category || fields.price === undefined) {
        throw new ApiError(400, "Name, category, and price are required.");
      }
      if (fields.available === undefined) fields.available = true;
      const item = await store.addMenuItem(fields);
      res.status(201).json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/menu/:id", async (req, res, next) => {
    try {
      const patch = menuFields(req.body || {});
      if (Object.keys(patch).length === 0) {
        throw new ApiError(400, "Nothing to update.");
      }
      const item = await store.updateMenuItem(req.params.id, patch);
      if (!item) {
        throw new ApiError(404, "Menu item not found.");
      }
      res.json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/menu/:id", async (req, res, next) => {
    try {
      const removed = await store.deleteMenuItem(req.params.id);
      if (!removed) {
        throw new ApiError(404, "Menu item not found.");
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/customers", async (req, res, next) => {
    try {
      res.json({ customers: await store.listCustomers() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/customers/:phone/redeem", async (req, res, next) => {
    try {
      const phone = normalizePhone(req.params.phone);
      const loyalty = await store.redeemReward(phone);
      if (!loyalty) {
        throw new ApiError(400, "That customer doesn't have a reward ready yet.");
      }
      res.json({ loyalty });
    } catch (error) {
      next(error);
    }
  });

  router.get("/settings", async (req, res, next) => {
    try {
      res.json({ settings: await store.getSettings() });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/settings", async (req, res, next) => {
    try {
      const patch = settingsFields(req.body || {});
      if (Object.keys(patch).length === 0) {
        throw new ApiError(400, "Nothing to update.");
      }
      const settings = await store.updateSettings(patch);
      res.json({ settings });
    } catch (error) {
      next(error);
    }
  });

  router.get("/bills", async (req, res, next) => {
    try {
      res.json({ bills: await store.listBills() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/bills", async (req, res, next) => {
    try {
      const body = req.body || {};
      const items = body.items;
      if (!Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, "Add at least one item to the bill.");
      }
      items.forEach((entry, index) => {
        if (!entry.name || String(entry.name).trim().length === 0) {
          throw new ApiError(400, `Item ${index + 1} needs a name.`);
        }
        money(entry.price, { label: `Item ${index + 1} price` });
        integer(entry.qty, {
          label: `Item ${index + 1} quantity`,
          min: 1,
          max: 999,
        });
      });
      const customerName = body.customerName
        ? str(body.customerName, { label: "Customer name", max: 100 })
        : "";
      const customerPhone = body.customerPhone
        ? normalizePhone(body.customerPhone)
        : "";
      const bill = await store.createBill({
        items,
        total: body.total,
        itemCount: body.itemCount,
        customerName,
        customerPhone,
      });
      res.status(201).json({ bill });
    } catch (error) {
      next(error);
    }
  });

  router.get("/bills/:id", async (req, res, next) => {
    try {
      const bill = await store.findBill(req.params.id);
      if (!bill) {
        throw new ApiError(404, "Bill not found.");
      }
      res.json({ bill });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
