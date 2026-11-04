import express from "express";
import {
  ApiError,
  addDaysStr,
  dateStr,
  integer,
  maskName,
  normalizePhone,
  optionalStr,
  rateLimit,
  round2,
  str,
  todayStr,
  weekdayOf,
} from "../lib/util.js";

function detectImage(buffer) {
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "jpg";
  }
  if (
    buffer.length > 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (
    buffer.length > 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function publicOrder(order) {
  return {
    code: order.code,
    items: order.items,
    total: order.total,
    pickupDate: order.pickupDate,
    slot: order.slot,
    notes: order.notes,
    cake: order.cake,
    status: order.status,
    createdAt: order.createdAt,
  };
}

export default function publicRoutes({ store }) {
  const router = express.Router();
  const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: "That's a lot of orders from one place. Please try again in a little while.",
  });

  router.get("/bootstrap", async (req, res, next) => {
    try {
      const [settings, menu] = await Promise.all([
        store.getSettings(),
        store.getMenu(true),
      ]);
      res.json({ settings, menu });
    } catch (error) {
      next(error);
    }
  });

  router.get("/loyalty", async (req, res, next) => {
    try {
      const phone = normalizePhone(req.query.phone);
      const loyalty = await store.getLoyalty(phone);
      res.json({
        ...loyalty,
        name: loyalty.name ? maskName(loyalty.name) : "",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/orders", orderLimiter, async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const settings = await store.getSettings();

      const customerName = str(body.name, {
        label: "Name",
        min: 2,
        max: 80,
      });
      const phone = normalizePhone(body.phone);
      const notes = optionalStr(body.notes, {
        label: "Order notes",
        max: 400,
      });
      const cakeDescription = optionalStr(body.cakeDescription, {
        label: "Cake details",
        min: 5,
        max: 600,
      });

      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length > 40) {
        throw new ApiError(400, "That's too many items for one order.");
      }

      const quantities = new Map();
      for (const raw of rawItems) {
        if (!raw || typeof raw !== "object") {
          throw new ApiError(400, "One of the order items was invalid.");
        }
        const id = str(raw.id, { label: "Item", min: 1, max: 100 });
        const qty = integer(raw.qty, {
          label: "Quantity",
          min: 1,
          max: 20,
        });
        const next = (quantities.get(id) || 0) + qty;
        if (next > 20) {
          throw new ApiError(400, "Maximum quantity per item is 20.");
        }
        quantities.set(id, next);
      }

      const available = new Map((await store.getMenu()).map((item) => [item.id, item]));
      const items = [];
      let total = 0;

      for (const [id, qty] of quantities) {
        const item = available.get(id);
        if (!item) {
          throw new ApiError(
            400,
            "One of the items is no longer available. Please refresh the menu and try again.",
          );
        }
        items.push({
          menuId: item.id,
          name: item.name,
          price: item.price,
          qty,
        });
        total = round2(total + item.price * qty);
      }

      const wantsCake = Boolean(cakeDescription) || Boolean(body.referenceImage);
      if (items.length === 0 && !wantsCake) {
        throw new ApiError(400, "Add something to your order first.");
      }

      const pickupDate = dateStr(body.pickupDate, { label: "Pickup date" });
      const today = todayStr();
      if (pickupDate < today) {
        throw new ApiError(400, "That pickup date has already passed.");
      }
      if (pickupDate > addDaysStr(today, 14)) {
        throw new ApiError(400, "Pickups can be booked up to two weeks ahead.");
      }
      if ((settings.closedWeekdays || []).includes(weekdayOf(pickupDate))) {
        throw new ApiError(
          400,
          "The bakery is closed on that day. Please choose another pickup date.",
        );
      }
      if (wantsCake && pickupDate < addDaysStr(today, 2)) {
        throw new ApiError(400, "Custom cakes need at least 48 hours' notice.");
      }

      const slot = str(body.slot, {
        label: "Pickup slot",
        min: 1,
        max: 60,
      });
      if (!(settings.slots || []).includes(slot)) {
        throw new ApiError(400, "Please choose one of the available pickup slots.");
      }

      let referenceImage = "";
      if (body.referenceImage) {
        const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
          String(body.referenceImage),
        );
        if (!match) {
          throw new ApiError(400, "Please upload a JPG, PNG, or WebP image.");
        }
        const buffer = Buffer.from(match[2], "base64");
        if (buffer.length > 2 * 1024 * 1024) {
          throw new ApiError(400, "That image is too large. Please use one under 2 MB.");
        }
        if (buffer.length < 100) {
          throw new ApiError(400, "That image looks empty. Please try another one.");
        }
        const extension = detectImage(buffer);
        if (!extension) {
          throw new ApiError(400, "Please upload a valid JPG, PNG, or WebP image.");
        }
        referenceImage = await store.saveUpload(buffer, extension);
      }

      const cake = wantsCake
        ? {
            description:
              cakeDescription || "Custom cake request — see reference photo.",
            referenceImage,
          }
        : null;

      const order = await store.createOrder({
        customer: { name: customerName, phone },
        items,
        total,
        pickupDate,
        slot,
        notes,
        cake,
      });
      const loyalty = await store.getLoyalty(phone);

      res.status(201).json({
        order: publicOrder(order),
        loyalty: {
          stamps: loyalty.stamps,
          target: loyalty.target,
          rewardsReady: loyalty.rewardsReady,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/orders/:code", async (req, res, next) => {
    try {
      const code = str(req.params.code, { label: "Order code", min: 1, max: 40 });
      const phone = normalizePhone(req.query.phone);
      const order = await store.findOrderByCode(code, phone);
      if (!order) {
        throw new ApiError(404, "We couldn't find that order.");
      }
      res.json({ order: publicOrder(order) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/uploads/:id", async (req, res, next) => {
    try {
      if (!/^[\w.-]{1,80}$/.test(req.params.id)) {
        throw new ApiError(404, "Not found.");
      }
      const upload = await store.getUpload(req.params.id);
      if (!upload) throw new ApiError(404, "Not found.");
      res.setHeader("Content-Type", upload.mime);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(upload.bytes);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
