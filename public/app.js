const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const CART_KEY = "gc_cart_v1";

const ICONS = {
  breads: `<svg class="dish-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 31c0-9 9.5-16 22-16s22 7 22 16v13c0 3-2.5 5-5 5H15c-2.5 0-5-2-5-5V31Z"/><path d="M10 31c5 4 12.5 6 22 6s17-2 22-6"/><path d="M23 23c2 3 2.5 6 2 9M32 21c1.5 3.5 1.5 7 0 10M41 23c-2 3-2.5 6-2 9"/></svg>`,
  pastries: `<svg class="dish-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 39c0-10.5 10-19 23-19s23 8.5 23 19c0 4.5-3.4 7.6-7.6 6.3-3-.9-4.6-3.2-6.4-5.8-2.3 4.4-5.3 6.5-9 6.5s-6.7-2.1-9-6.5c-1.8 2.6-3.4 4.9-6.4 5.8C12.4 46.6 9 43.5 9 39Z"/><path d="M19 35c3 4.5 7.7 7 13 7s10-2.5 13-7"/><path d="M26 27c1 3.4 1.4 6.8 1 10M32 25c.6 3.7.6 7.3 0 11M38 27c-1 3.4-1.4 6.8-1 10"/></svg>`,
  cakes: `<svg class="dish-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 48V35c0-2.2 1.8-4 4-4h24c2.2 0 4 1.8 4 4v13"/><path d="M16 40c4 0 4-3 8-3s4 3 8 3 4-3 8-3 4 3 8 3"/><path d="M13 48h38M22 48v5M42 48v5"/><path d="M32 31v-6M32 22c-1.7-1.4-.8-3 .8-4.2"/></svg>`,
  cookies: `<svg class="dish-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="33" r="18"/><circle cx="26" cy="27" r="1.7" fill="currentColor" stroke="none"/><circle cx="37" cy="24" r="1.5" fill="currentColor" stroke="none"/><circle cx="41" cy="35" r="1.7" fill="currentColor" stroke="none"/><circle cx="30" cy="39" r="1.5" fill="currentColor" stroke="none"/><circle cx="22" cy="35" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  coffee: `<svg class="dish-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 27h28v10a11 11 0 0 1-11 11h-6a11 11 0 0 1-11-11V27Z"/><path d="M42 30h4.5a6.5 6.5 0 0 1 0 13H42"/><path d="M21 20c-2-2 2-4 0-6M30 20c-2-2 2-4 0-6M39 20c-2-2 2-4 0-6"/><path d="M12 51h32"/></svg>`,
  default: `<svg class="dish-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 54V20"/><path d="M32 29c-6 0-10-4-10-10 6 0 10 4 10 10Z"/><path d="M32 29c6 0 10-4 10-10-6 0-10 4-10 10Z"/><path d="M32 39c-6 0-10-4-10-10 6 0 10 4 10 10Z"/><path d="M32 39c6 0 10-4 10-10-6 0-10 4-10 10Z"/><path d="M32 49c-6 0-10-4-10-10 6 0 10 4 10 10Z"/><path d="M32 49c6 0 10-4 10-10-6 0-10 4-10 10Z"/></svg>`,
};

const state = {
  settings: null,
  menu: [],
  categories: [],
  category: "All",
  search: "",
  cart: new Map(),
  cakeEnabled: false,
  cakePhoto: "",
  photoBusy: false,
  lastOrder: null,
  lastOrderName: "",
  loyalty: null,
};

const els = {
  header: $("#siteHeader"),
  menuGrid: $("#menuGrid"),
  menuEmpty: $("#menuEmpty"),
  menuError: $("#menuError"),
  categoryTabs: $("#categoryTabs"),
  menuSearch: $("#menuSearch"),
  cartCount: $("#cartCount"),
  cartItems: $("#cartItems"),
  cartSubtotal: $("#cartSubtotal"),
  checkoutForm: $("#checkoutForm"),
  cakeToggle: $("#cakeToggle"),
  cakeFields: $("#cakeFields"),
  cakeDescription: $("#cakeDescription"),
  cakePhoto: $("#cakePhoto"),
  photoName: $("#photoName"),
  photoPreviewWrap: $("#photoPreviewWrap"),
  photoPreview: $("#photoPreview"),
  removePhoto: $("#removePhoto"),
  customerName: $("#customerName"),
  customerPhone: $("#customerPhone"),
  pickupDate: $("#pickupDate"),
  pickupSlot: $("#pickupSlot"),
  orderNotes: $("#orderNotes"),
  paymentHint: $("#paymentHint"),
  formError: $("#formError"),
  placeOrder: $("#placeOrder"),
  drawer: $("#drawer"),
  drawerBody: $(".drawer-body"),
  drawerOverlay: $("#drawerOverlay"),
  drawerTitle: $("#drawerTitle"),
  cartView: $("#cartView"),
  confirmationView: $("#confirmationView"),
  confirmationTitle: $("#confirmationTitle"),
  confirmationCode: $("#confirmationCode"),
  confirmationLede: $("#confirmationLede"),
  confirmationSummary: $("#confirmationSummary"),
  confirmationLoyalty: $("#confirmationLoyalty"),
  sendWhatsApp: $("#sendWhatsApp"),
  loyaltyModal: $("#loyaltyModal"),
  loyaltyForm: $("#loyaltyForm"),
  loyaltyPhone: $("#loyaltyPhone"),
  loyaltyResult: $("#loyaltyResult"),
  toast: $("#toast"),
};

let drawerLastFocus = null;
let loyaltyLastFocus = null;
let toastTimer = null;

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

const escapeAttr = escapeHtml;

function currencySymbol() {
  return state.settings?.currency || "₹";
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return `${currencySymbol()}${number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function localISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateLabel(value) {
  if (!value) return "";
  const date = parseDate(value);
  const today = startOfToday();
  const diff = Math.round((date - today) / 86400000);
  const label = date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (diff === 0) return `Today · ${label}`;
  if (diff === 1) return `Tomorrow · ${label}`;
  return label;
}

function categoryKey(category) {
  const key = String(category || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const aliases = {
    slicecakes: "cakes",
    cupcakes: "cakes",
    toast: "breads",
    khari: "breads",
    butter: "cookies",
  };
  const resolved = aliases[key] || key;
  return ["breads", "pastries", "cakes", "cookies", "coffee"].includes(resolved)
    ? resolved
    : "default";
}

function iconFor(category) {
  return ICONS[categoryKey(category)] || ICONS.default;
}

function visualClass(category) {
  const key = categoryKey(category);
  return key === "default" ? "visual-default" : `visual-${key}`;
}

function itemById(id) {
  return state.menu.find((item) => item.id === id);
}

function cartCount() {
  let count = 0;
  for (const quantity of state.cart.values()) count += quantity;
  return count;
}

function cartSubtotal() {
  let total = 0;
  for (const [id, quantity] of state.cart) {
    const item = itemById(id);
    if (item) total += item.price * quantity;
  }
  return Math.round(total * 100) / 100;
}

function persistCart() {
  try {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify(Object.fromEntries(state.cart.entries())),
    );
  } catch {
    /* storage can be unavailable in private mode */
  }
}

function restoreCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Map();
    const cart = new Map();
    for (const [id, quantity] of Object.entries(parsed)) {
      const value = Number(quantity);
      if (Number.isFinite(value) && value > 0) {
        cart.set(String(id), Math.min(20, Math.floor(value)));
      }
    }
    return cart;
  } catch {
    return new Map();
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* empty response */
  }
  if (!response.ok) {
    throw new Error(
      (data && data.error) || "Something went wrong. Please try again.",
    );
  }
  return data;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2800);
}

function syncScrollLock() {
  const locked =
    !els.loyaltyModal.hidden || els.drawer.classList.contains("open");
  document.body.classList.toggle("no-scroll", locked);
}

function trapFocus(event, container) {
  if (event.key !== "Tab" || !container) return;
  const focusables = [
    ...container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => element.getClientRects().length > 0);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openDrawer(focusSelector) {
  if (!els.loyaltyModal.hidden) closeLoyalty(false);
  drawerLastFocus = document.activeElement;
  els.drawerOverlay.hidden = false;
  els.drawer.classList.add("open");
  els.drawer.setAttribute("aria-hidden", "false");
  syncScrollLock();
  requestAnimationFrame(() => {
    const target = focusSelector ? $(focusSelector) : $("#closeDrawer");
    if (target) target.focus();
  });
}

function closeDrawer(restoreFocus = true) {
  if (!els.drawer.classList.contains("open")) return;
  els.drawer.classList.remove("open");
  els.drawer.setAttribute("aria-hidden", "true");
  els.drawerOverlay.hidden = true;
  els.drawerTitle.textContent = "Your bag";
  syncScrollLock();
  if (restoreFocus && drawerLastFocus) {
    drawerLastFocus.focus();
    drawerLastFocus = null;
  }
}

function openLoyalty() {
  if (els.drawer.classList.contains("open")) closeDrawer(false);
  loyaltyLastFocus = document.activeElement;
  els.loyaltyModal.hidden = false;
  syncScrollLock();
  if (!els.loyaltyPhone.value && els.customerPhone.value) {
    els.loyaltyPhone.value = els.customerPhone.value;
  }
  requestAnimationFrame(() => {
    if (els.loyaltyPhone.value) {
      els.loyaltyPhone.focus();
      els.loyaltyPhone.select();
    } else {
      els.loyaltyPhone.focus();
    }
  });
}

function closeLoyalty(restoreFocus = true) {
  if (els.loyaltyModal.hidden) return;
  els.loyaltyModal.hidden = true;
  syncScrollLock();
  if (restoreFocus && loyaltyLastFocus) {
    loyaltyLastFocus.focus();
    loyaltyLastFocus = null;
  }
}

function applySettings() {
  const settings = state.settings;
  if (!settings) return;

  $$("[data-brand]").forEach((element) => {
    element.textContent = settings.bakeryName;
  });
  const tagline = $("[data-tagline]");
  if (tagline) tagline.textContent = settings.tagline;
  const story = $("[data-story]");
  if (story) story.textContent = settings.story;
  const address = $("[data-address]");
  if (address) address.textContent = settings.address;
  const notice = $("[data-notice]");
  if (notice) notice.textContent = settings.notice;
  const loyaltyBlurb = $("[data-loyalty-blurb]");
  if (loyaltyBlurb) loyaltyBlurb.textContent = settings.loyaltyBlurb;

  const hours = $("[data-hours]");
  if (hours) {
    hours.innerHTML = (settings.hours || [])
      .map(
        (row) =>
          `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(
            row.value,
          )}</dd></div>`,
      )
      .join("");
  }

  $$("[data-whatsapp]").forEach((link) => {
    const text = encodeURIComponent(
      `Hi ${settings.bakeryName}! I'd like to ask about your bakes.`,
    );
    link.href = `https://wa.me/${String(settings.whatsapp).replace(
      /[^\d]/g,
      "",
    )}?text=${text}`;
  });

  $$("[data-instagram]").forEach((link) => {
    link.href = `https://instagram.com/${settings.instagram}`;
  });

  document.title = `${settings.bakeryName} — Fresh bread & pastries`;
}

function renderTabs() {
  const categories = [
    "All",
    ...new Set(state.menu.map((item) => item.category)),
  ];
  state.categories = categories;
  if (!categories.includes(state.category)) state.category = "All";
  els.categoryTabs.innerHTML = categories
    .map(
      (category) => `
        <button
          class="tab"
          type="button"
          role="tab"
          data-cat="${escapeAttr(category)}"
          aria-selected="${category === state.category}"
        >${escapeHtml(category)}</button>`,
    )
    .join("");
}

function dishActionsHtml(item) {
  if (!item.available) {
    return `<span class="hint">Back tomorrow</span>`;
  }
  const id = escapeAttr(item.id);
  const quantity = state.cart.get(item.id) || 0;
  if (quantity === 0) {
    return `<button class="add-button" type="button" data-add="${id}" aria-label="Add ${escapeAttr(
      item.name,
    )} to bag">Add to bag</button>`;
  }
  return `<div class="stepper">
      <button type="button" data-dec="${id}" aria-label="Remove one ${escapeAttr(
        item.name,
      )}">−</button>
      <span class="stepper-qty">${quantity}</span>
      <button type="button" data-inc="${id}" aria-label="Add another ${escapeAttr(
        item.name,
      )}">+</button>
    </div>`;
}

function dishHtml(item) {
  const tag = item.tag
    ? `<span class="dish-tag">${escapeHtml(item.tag)}</span>`
    : "";
  const soldOut = item.available
    ? ""
    : `<span class="sold-out-flag">Sold out</span>`;
  return `
    <article class="dish" data-id="${escapeAttr(item.id)}">
      <div class="dish-visual ${visualClass(item.category)}">
        ${iconFor(item.category)}
        ${tag}
        ${soldOut}
      </div>
      <div class="dish-body">
        <div class="dish-title-row">
          <h3>${escapeHtml(item.name)}</h3>
          <span class="dish-price">${formatMoney(item.price)}</span>
        </div>
        <p class="dish-description">${escapeHtml(item.description)}</p>
        <div class="dish-actions" data-dish-actions="${escapeAttr(item.id)}">
          ${dishActionsHtml(item)}
        </div>
      </div>
    </article>`;
}

function renderMenu() {
  if (!state.settings) return;
  const term = state.search.trim().toLowerCase();
  const items = state.menu.filter((item) => {
    const matchesCategory =
      state.category === "All" || item.category === state.category;
    const haystack =
      `${item.name} ${item.description} ${item.category} ${item.tag}`.toLowerCase();
    return matchesCategory && (!term || haystack.includes(term));
  });

  els.menuGrid.innerHTML = items.map(dishHtml).join("");
  els.menuEmpty.hidden = items.length > 0;
  els.menuError.hidden = true;
}

function syncMenuActions() {
  $$("[data-dish-actions]").forEach((container) => {
    const item = itemById(container.dataset.dishActions);
    if (item) container.innerHTML = dishActionsHtml(item);
  });
}

function renderCart() {
  const count = cartCount();
  els.cartCount.textContent = String(count);
  els.cartCount.hidden = count === 0;

  if (count === 0) {
    els.cartItems.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M6.5 8.5h11l1 11.5h-13l1-11.5Z" stroke-linejoin="round"/>
          <path d="M9 9V7a3 3 0 0 1 6 0v2" stroke-linecap="round"/>
        </svg>
        <h3>Your bag is empty</h3>
        <p>Add a few bakes, or send us a custom cake request below.</p>
        <button class="btn btn-ghost btn-small" type="button" data-browse>Browse the menu</button>
      </div>`;
  } else {
    els.cartItems.innerHTML = [...state.cart]
      .map(([id, quantity]) => {
        const item = itemById(id);
        if (!item) return "";
        return `
          <div class="cart-item">
            <div>
              <div class="cart-item-name">${escapeHtml(item.name)}</div>
              <div class="cart-item-price">${formatMoney(
                item.price,
              )} each</div>
            </div>
            <div class="cart-item-line">${formatMoney(
              item.price * quantity,
            )}</div>
            <div class="cart-item-controls">
              <div class="stepper">
                <button type="button" data-dec="${escapeAttr(id)}" aria-label="Remove one ${escapeAttr(
                  item.name,
                )}">−</button>
                <span class="stepper-qty">${quantity}</span>
                <button type="button" data-inc="${escapeAttr(id)}" aria-label="Add another ${escapeAttr(
                  item.name,
                )}">+</button>
              </div>
              <button class="text-button" type="button" data-remove="${escapeAttr(
                id,
              )}">Remove</button>
            </div>
          </div>`;
      })
      .join("");
  }

  els.cartSubtotal.textContent = formatMoney(cartSubtotal());
  els.checkoutForm.hidden = count === 0 && !state.cakeEnabled;
  els.paymentHint.textContent =
    count === 0
      ? "Custom cakes are quoted after we review your request."
      : "Pay at pickup. No online payment needed.";
  els.placeOrder.textContent =
    count === 0 ? "Send cake request" : "Place pickup order";
}

function setQuantity(id, nextQuantity) {
  const item = itemById(id);
  if (!item || !item.available) return;
  const quantity = Math.max(0, Math.min(20, nextQuantity));
  if (quantity === 0) {
    state.cart.delete(id);
  } else {
    state.cart.set(id, quantity);
  }
  persistCart();
  renderCart();
  syncMenuActions();
}

function populateDates() {
  if (!state.settings) return;
  const settings = state.settings;
  const closed = new Set(settings.closedWeekdays || []);
  const today = startOfToday();
  const previous = els.pickupDate.value;
  const options = [];

  for (let offset = 0; offset < 15 && options.length < 14; offset += 1) {
    if (state.cakeEnabled && offset < 2) continue;
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    if (closed.has(date.getDay())) continue;
    options.push({
      value: localISO(date),
      label: formatDateLabel(localISO(date)),
    });
  }

  els.pickupDate.innerHTML =
    `<option value="">Choose a day</option>` +
    options
      .map(
        (option) =>
          `<option value="${option.value}">${escapeHtml(option.label)}</option>`,
      )
      .join("");

  if (options.some((option) => option.value === previous)) {
    els.pickupDate.value = previous;
  }
}

function populateSlots() {
  if (!state.settings) return;
  const previous = els.pickupSlot.value;
  els.pickupSlot.innerHTML =
    `<option value="">Choose a time</option>` +
    (state.settings.slots || [])
      .map(
        (slot) =>
          `<option value="${escapeAttr(slot)}">${escapeHtml(slot)}</option>`,
      )
      .join("");
  if ((state.settings.slots || []).includes(previous)) {
    els.pickupSlot.value = previous;
  }
}

function clearCakeState() {
  state.cakeEnabled = false;
  state.cakePhoto = "";
  state.photoBusy = false;
  els.cakeToggle.checked = false;
  els.cakeFields.hidden = true;
  els.cakeDescription.value = "";
  els.cakePhoto.value = "";
  els.photoPreview.removeAttribute("src");
  els.photoPreviewWrap.hidden = true;
  els.photoName.textContent = "JPG, PNG, or WebP. We'll shrink it for you.";
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.hidden = !message;
}

async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("That photo is too large. Please choose one under 8 MB.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("That image couldn't be read. Please try another."));
      };
      image.src = url;
    });
  }

  const maxSide = 1400;
  const scale = Math.min(
    1,
    maxSide / Math.max(bitmap.width || 1, bitmap.height || 1),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((bitmap.width || 1) * scale));
  canvas.height = Math.max(1, Math.round((bitmap.height || 1) * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (typeof bitmap.close === "function") bitmap.close();

  let dataUrl = canvas.toDataURL("image/jpeg", 0.84);
  if (dataUrl.length > 2400000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.68);
  }
  if (dataUrl.length > 2600000) {
    throw new Error("That photo is still too large. Try a smaller image.");
  }
  return dataUrl;
}

function validateCheckout() {
  const name = els.customerName.value.trim();
  const digits = els.customerPhone.value.replace(/\D/g, "");
  if (name.length < 2) return "Please add your name.";
  if (digits.length < 10 || digits.length > 15) {
    return "Please add a valid phone number (10 to 15 digits).";
  }
  if (cartCount() === 0 && !state.cakeEnabled) {
    return "Add something to your bag first.";
  }
  if (state.cakeEnabled) {
    const description = els.cakeDescription.value.trim();
    if (description.length > 0 && description.length < 5) {
      return "Tell us a little more about the cake.";
    }
    if (!description && !state.cakePhoto) {
      return "Tell us about the cake, or add a reference photo.";
    }
    if (state.photoBusy) return "Your photo is still being prepared — one moment.";
  }
  if (!els.pickupDate.value) return "Please choose a pickup date.";
  if (!els.pickupSlot.value) return "Please choose a pickup slot.";

  if (state.cakeEnabled) {
    const earliest = new Date(startOfToday());
    earliest.setDate(earliest.getDate() + 2);
    if (parseDate(els.pickupDate.value) < earliest) {
      return "Custom cakes need 48 hours' notice. Please pick a later date.";
    }
  }
  return "";
}

function buildWhatsAppUrl(order) {
  const settings = state.settings;
  const lines = [
    `Hi ${settings.bakeryName}! I've placed a pickup order.`,
    "",
    `Order: ${order.code}`,
    `Name: ${state.lastOrderName}`,
    `Pickup: ${formatDateLabel(order.pickupDate)}, ${order.slot}`,
  ];

  if (order.items.length > 0) {
    lines.push("", "Items:");
    for (const item of order.items) {
      lines.push(
        `• ${item.qty} × ${item.name} — ${formatMoney(item.price * item.qty)}`,
      );
    }
    lines.push(`Total: ${formatMoney(order.total)}`);
  }

  if (order.cake) {
    lines.push("", `Custom cake: ${order.cake.description}`);
    if (order.cake.referenceImage) {
      lines.push("Reference photo attached to the order.");
    }
  }

  if (order.notes) {
    lines.push("", `Notes: ${order.notes}`);
  }

  return `https://wa.me/${String(settings.whatsapp).replace(
    /[^\d]/g,
    "",
  )}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function stampsMarkup(stamps, target) {
  const filled = Math.min(stamps, target);
  return Array.from(
    { length: target },
    (_, index) =>
      `<span class="stamp${index < filled ? " filled" : ""}">${
        index < filled ? "✓" : index + 1
      }</span>`,
  ).join("");
}

function showConfirmation(order, loyalty) {
  const firstName = (state.lastOrderName || "friend").trim().split(/\s+/)[0];
  const isCakeOnly = order.items.length === 0 && order.cake;

  els.cartView.hidden = true;
  els.confirmationView.hidden = false;
  els.drawerTitle.textContent = "Order confirmed";
  els.confirmationTitle.textContent = isCakeOnly
    ? `Cake request received, ${firstName}.`
    : `See you at pickup, ${firstName}.`;
  els.confirmationCode.textContent = order.code;
  els.confirmationLede.textContent = isCakeOnly
    ? "We've saved your request. Send it on WhatsApp so we can chat through the design and send you a quote."
    : "Your order is saved. Send it on WhatsApp so the bakery can confirm your pickup.";

  const summaryLines = [];
  for (const item of order.items) {
    summaryLines.push(
      `<div class="summary-line"><span>${item.qty} × ${escapeHtml(
        item.name,
      )}</span><span>${formatMoney(item.price * item.qty)}</span></div>`,
    );
  }
  if (order.cake) {
    summaryLines.push(
      `<div class="summary-line"><span>Custom cake request</span><span>${
        order.items.length === 0 ? "Quote to follow" : "Added"
      }</span></div>`,
    );
  }

  els.confirmationSummary.innerHTML = `
    <h3>Pickup details</h3>
    ${summaryLines.join("")}
    <div class="summary-total">
      <span>${isCakeOnly ? "Cake quote" : "Total at pickup"}</span>
      <span>${isCakeOnly ? "To follow" : formatMoney(order.total)}</span>
    </div>
    <div class="pickup-line">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5"/>
        <path d="M12 7.5V12l3 2" stroke-linecap="round"/>
      </svg>
      <span>${escapeHtml(formatDateLabel(order.pickupDate))} · ${escapeHtml(
        order.slot,
      )}</span>
    </div>`;

  const target = loyalty.target || state.settings.loyaltyTarget || 10;
  const rewardText =
    loyalty.rewardsReady > 0
      ? " You already have a reward ready — mention it at pickup."
      : "";
  els.confirmationLoyalty.innerHTML = `
    <div class="stamp-counter">${Math.min(loyalty.stamps, target)}/${target}</div>
    <div class="stamp-copy">
      <strong>Loyalty card</strong>
      This pickup adds one more stamp.${rewardText}
    </div>`;

  els.sendWhatsApp.href = buildWhatsAppUrl(order);
  els.sendWhatsApp.textContent = isCakeOnly
    ? "Send request on WhatsApp"
    : "Send order on WhatsApp";

  els.drawerBody.scrollTop = 0;
  els.confirmationTitle.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => els.confirmationTitle.focus());
}

function resetOrderFlow() {
  els.confirmationView.hidden = true;
  els.cartView.hidden = false;
  els.drawerTitle.textContent = "Your bag";
  els.orderNotes.value = "";
  els.formError.hidden = true;
  els.placeOrder.disabled = false;
  state.cart.clear();
  state.lastOrder = null;
  persistCart();
  clearCakeState();
  populateDates();
  els.pickupDate.value = "";
  els.pickupSlot.value = "";
  renderCart();
  syncMenuActions();
  closeDrawer();
  const menuSection = $("#menu");
  if (menuSection) {
    menuSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  showToast("Ready when you are.");
}

async function handleCheckout(event) {
  event.preventDefault();
  showFormError("");

  const message = validateCheckout();
  if (message) {
    showFormError(message);
    return;
  }

  state.lastOrderName = els.customerName.value.trim();
  const payload = {
    name: state.lastOrderName,
    phone: els.customerPhone.value,
    items: [...state.cart].map(([id, qty]) => ({ id, qty })),
    pickupDate: els.pickupDate.value,
    slot: els.pickupSlot.value,
    notes: els.orderNotes.value,
    cakeDescription: state.cakeEnabled
      ? els.cakeDescription.value.trim()
      : "",
    referenceImage: state.cakeEnabled ? state.cakePhoto : "",
  };

  els.placeOrder.disabled = true;
  els.placeOrder.textContent = "Placing your order…";

  try {
    const result = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.lastOrder = result.order;
    state.loyalty = result.loyalty;
    state.cart.clear();
    persistCart();
    renderCart();
    syncMenuActions();
    showConfirmation(result.order, result.loyalty);
  } catch (error) {
    showFormError(error.message);
    els.placeOrder.disabled = false;
    els.placeOrder.textContent =
      cartCount() === 0 ? "Send cake request" : "Place pickup order";
  }
}

async function handleLoyaltyCheck(event) {
  event.preventDefault();
  const digits = els.loyaltyPhone.value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    els.loyaltyResult.innerHTML = `<div class="loyalty-empty">Please enter the phone number you use for orders.</div>`;
    return;
  }

  els.loyaltyResult.innerHTML = `<div class="loyalty-empty">Checking your stamps…</div>`;
  try {
    const data = await api(
      `/api/loyalty?phone=${encodeURIComponent(els.loyaltyPhone.value)}`,
    );
    if (!data.found) {
      els.loyaltyResult.innerHTML = `
        <div class="loyalty-empty">
          <strong>No stamps yet.</strong><br />
          Pick up your first order to start the card.
          <div style="margin-top:12px">
            <button class="text-button" type="button" data-browse-loyalty>Browse the menu</button>
          </div>
        </div>`;
      return;
    }

    els.loyaltyResult.innerHTML = `
      <div class="loyalty-card">
        <div class="loyalty-card-head">
          <strong>${escapeHtml(data.name || "Friend")}</strong>
          <span>${data.stamps} of ${data.target} stamps</span>
        </div>
        <div class="stamp-grid">${stampsMarkup(data.stamps, data.target)}</div>
        <p class="loyalty-note">
          ${
            data.rewardsReady > 0
              ? "Your free bake is ready. Mention it at pickup."
              : `${Math.max(
                  data.target - (data.stamps % data.target),
                  0,
                )} more pickups until a free bake.`
          }
        </p>
        ${
          data.rewardsReady > 0
            ? `<div class="loyalty-reward">${data.rewardsReady} reward${
                data.rewardsReady > 1 ? "s" : ""
              } ready to redeem</div>`
            : ""
        }
        ${
          data.rewardsRedeemed > 0
            ? `<p class="loyalty-note" style="margin-top:10px">${data.rewardsRedeemed} reward${
                data.rewardsRedeemed > 1 ? "s" : ""
              } redeemed so far.</p>`
            : ""
        }
      </div>`;
  } catch (error) {
    els.loyaltyResult.innerHTML = `<div class="loyalty-empty">${escapeHtml(
      error.message,
    )}</div>`;
  }
}

function hydrateCart() {
  const available = new Map(
    state.menu.filter((item) => item.available).map((item) => [item.id, item]),
  );
  for (const [id, quantity] of [...state.cart]) {
    if (!available.has(id)) {
      state.cart.delete(id);
    } else {
      state.cart.set(id, Math.max(1, Math.min(20, quantity)));
    }
  }
  persistCart();
}

async function loadData() {
  els.menuError.hidden = true;
  try {
    const data = await api("/api/bootstrap");
    state.settings = data.settings;
    state.menu = data.menu;
    hydrateCart();
    applySettings();
    renderTabs();
    renderMenu();
    populateDates();
    populateSlots();
    renderCart();
  } catch (error) {
    els.menuGrid.innerHTML = "";
    els.menuEmpty.hidden = true;
    els.menuError.hidden = false;
    showToast("We couldn't load the menu. Please refresh.");
  }
}

function init() {
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  state.cart = restoreCart();
  applySettings();
  renderCart();
  loadData();

  window.addEventListener(
    "scroll",
    () => {
      els.header.classList.toggle("scrolled", window.scrollY > 8);
    },
    { passive: true },
  );

  $("#openCart").addEventListener("click", () => openDrawer());
  $("#orderCta").addEventListener("click", () => openDrawer());
  $$("[data-order-now]").forEach((button) =>
    button.addEventListener("click", () => openDrawer()),
  );
  $("#closeDrawer").addEventListener("click", () => closeDrawer());
  els.drawerOverlay.addEventListener("click", () => closeDrawer());

  $("#openLoyalty").addEventListener("click", openLoyalty);
  $$("[data-open-loyalty]").forEach((button) =>
    button.addEventListener("click", openLoyalty),
  );
  $("#closeLoyalty").addEventListener("click", () => closeLoyalty());
  els.loyaltyModal.addEventListener("click", (event) => {
    if (event.target === els.loyaltyModal) closeLoyalty();
  });

  els.categoryTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-cat]");
    if (!tab) return;
    state.category = tab.dataset.cat;
    renderTabs();
    renderMenu();
  });

  let searchTimer;
  els.menuSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = els.menuSearch.value;
      renderMenu();
    }, 90);
  });

  $("[data-reset-filters]").addEventListener("click", () => {
    state.category = "All";
    state.search = "";
    els.menuSearch.value = "";
    renderTabs();
    renderMenu();
  });

  $("[data-retry]").addEventListener("click", () => {
    els.menuGrid.innerHTML = `<div class="dish skeleton"></div><div class="dish skeleton"></div><div class="dish skeleton"></div>`;
    loadData();
  });

  els.menuGrid.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    if (add) {
      const id = add.dataset.add;
      setQuantity(id, (state.cart.get(id) || 0) + 1);
      const item = itemById(id);
      if (item) showToast(`${item.name} added to your bag`);
      return;
    }
    const increment = event.target.closest("[data-inc]");
    if (increment) {
      const id = increment.dataset.inc;
      setQuantity(id, (state.cart.get(id) || 0) + 1);
      return;
    }
    const decrement = event.target.closest("[data-dec]");
    if (decrement) {
      const id = decrement.dataset.dec;
      setQuantity(id, (state.cart.get(id) || 0) - 1);
    }
  });

  els.cartItems.addEventListener("click", (event) => {
    const increment = event.target.closest("[data-inc]");
    if (increment) {
      const id = increment.dataset.inc;
      setQuantity(id, (state.cart.get(id) || 0) + 1);
      return;
    }
    const decrement = event.target.closest("[data-dec]");
    if (decrement) {
      const id = decrement.dataset.dec;
      setQuantity(id, (state.cart.get(id) || 0) - 1);
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      setQuantity(remove.dataset.remove, 0);
      return;
    }
    if (event.target.closest("[data-browse]")) {
      closeDrawer();
      $("#menu").scrollIntoView({ behavior: "smooth" });
    }
  });

  els.cakeToggle.addEventListener("change", () => {
    state.cakeEnabled = els.cakeToggle.checked;
    els.cakeFields.hidden = !state.cakeEnabled;
    if (!state.cakeEnabled) {
      state.cakePhoto = "";
      els.cakeDescription.value = "";
      els.cakePhoto.value = "";
      els.photoPreview.removeAttribute("src");
      els.photoPreviewWrap.hidden = true;
      els.photoName.textContent = "JPG, PNG, or WebP. We'll shrink it for you.";
    }
    populateDates();
    renderCart();
    if (state.cakeEnabled) {
      requestAnimationFrame(() => els.cakeDescription.focus());
    }
  });

  els.cakePhoto.addEventListener("change", async () => {
    const file = els.cakePhoto.files && els.cakePhoto.files[0];
    if (!file) return;
    state.photoBusy = true;
    els.photoName.textContent = "Preparing your photo…";
    try {
      const dataUrl = await shrinkImage(file);
      state.cakePhoto = dataUrl;
      els.photoPreview.src = dataUrl;
      els.photoPreviewWrap.hidden = false;
      els.photoName.textContent = `${file.name} · ready`;
    } catch (error) {
      state.cakePhoto = "";
      els.cakePhoto.value = "";
      els.photoPreviewWrap.hidden = true;
      els.photoName.textContent = "JPG, PNG, or WebP. We'll shrink it for you.";
      showToast(error.message);
    } finally {
      state.photoBusy = false;
    }
  });

  els.removePhoto.addEventListener("click", () => {
    state.cakePhoto = "";
    els.cakePhoto.value = "";
    els.photoPreview.removeAttribute("src");
    els.photoPreviewWrap.hidden = true;
    els.photoName.textContent = "JPG, PNG, or WebP. We'll shrink it for you.";
  });

  els.checkoutForm.addEventListener("submit", handleCheckout);
  els.loyaltyForm.addEventListener("submit", handleLoyaltyCheck);
  $("#orderAgain").addEventListener("click", resetOrderFlow);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-browse-loyalty]")) {
      closeLoyalty();
      openDrawer();
      $("#menu").scrollIntoView({ behavior: "smooth" });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.loyaltyModal.hidden) {
        closeLoyalty();
      } else if (els.drawer.classList.contains("open")) {
        closeDrawer();
      }
      return;
    }
    if (!els.loyaltyModal.hidden) {
      trapFocus(event, els.loyaltyModal);
    } else if (els.drawer.classList.contains("open")) {
      trapFocus(event, els.drawer);
    }
  });
}

init();
