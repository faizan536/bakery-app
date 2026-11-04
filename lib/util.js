export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function str(value, { label = "Field", min = 1, max = 200 } = {}) {
  if (typeof value !== "string") {
    throw new ApiError(400, `${label} is required.`);
  }
  const clean = value.replace(CONTROL_CHARS, "").replace(/[ \t]+/g, " ").trim();
  if (clean.length < min) {
    throw new ApiError(400, `${label} is too short.`);
  }
  if (clean.length > max) {
    throw new ApiError(400, `${label} is too long (max ${max} characters).`);
  }
  return clean;
}

export function optionalStr(
  value,
  { label = "Field", min = 0, max = 400 } = {},
) {
  if (value === undefined || value === null || value === "") return "";
  return str(value, { label, min, max });
}

export function normalizePhone(value) {
  if (typeof value !== "string") {
    throw new ApiError(400, "Please enter a valid phone number.");
  }
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new ApiError(
      400,
      "Please enter a valid phone number with 10 to 15 digits.",
    );
  }
  return digits;
}

export function money(value, { label = "Price", min = 0, max = 500000 } = {}) {
  const n =
    typeof value === "string" ? Number(value.replace(/,/g, "").trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
    throw new ApiError(400, `${label} must be between ${min} and ${max}.`);
  }
  return Math.round(n * 100) / 100;
}

export function integer(value, { label = "Value", min = 0, max = 100 } = {}) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ApiError(400, `${label} must be a whole number from ${min} to ${max}.`);
  }
  return n;
}

export function bool(value, { label = "Value" } = {}) {
  if (typeof value !== "boolean") {
    throw new ApiError(400, `${label} must be true or false.`);
  }
  return value;
}

export function formatLocalDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return formatLocalDate(new Date());
}

export function dateStr(value, { label = "Date" } = {}) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `Please choose a valid ${label.toLowerCase()}.`);
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || formatLocalDate(parsed) !== value) {
    throw new ApiError(400, `Please choose a valid ${label.toLowerCase()}.`);
  }
  return value;
}

export function addDaysStr(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function weekdayOf(dateString) {
  return new Date(`${dateString}T00:00:00`).getDay();
}

export function isPastDate(dateString) {
  return dateString < todayStr();
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function maskName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Friend";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

export function normalizeInstagram(value) {
  const handle = str(value, { label: "Instagram handle", min: 1, max: 40 })
    .replace(/^@+/, "")
    .replace(/https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "");
  if (!/^[A-Za-z0-9._]+$/.test(handle)) {
    throw new ApiError(400, "Instagram handle can only contain letters, numbers, dots, and underscores.");
  }
  return handle;
}

export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return function limiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let record = hits.get(key);
    if (!record || record.reset <= now) {
      record = { count: 0, reset: now + windowMs };
      hits.set(key, record);
    }
    record.count += 1;
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (v.reset <= now) hits.delete(k);
      }
    }
    if (record.count > max) {
      return next(
        new ApiError(
          429,
          message || "Too many requests. Please wait a moment and try again.",
        ),
      );
    }
    return next();
  };
}
