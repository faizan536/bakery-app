const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const STATUS_LABELS = {
  new: "New",
  ready: "Ready",
  completed: "Picked up",
  cancelled: "Cancelled",
};

const billCart = new Map();

const VIEW_TITLES = {
  billing: "Billing",
  orders: "Orders",
  menu: "Menu",
  customers: "Customers",
  settings: "Settings",
};

const state = {
  settings: null,
  orders: [],
  summary: null,
  menu: [],
  customers: [],
  filter: "all",
  view: "orders",
  editingItemId: null,
};

const els = {
  loginScreen: $("#loginScreen"),
  app: $("#adminApp"),
  loginForm: $("#loginForm"),
  loginPassword: $("#loginPassword"),
  loginButton: $("#loginButton"),
  loginError: $("#loginError"),
  todayLabel: $("#todayLabel"),
  viewTitle: $("#viewTitle"),
  refreshButton: $("#refreshButton"),
  newOrderBadge: $("#newOrderBadge"),
  statsGrid: $("#statsGrid"),
  orderFilters: $("#orderFilters"),
  ordersList: $("#ordersList"),
  ordersNote: $("#ordersNote"),
  countAll: $("#countAll"),
  countNew: $("#countNew"),
  countReady: $("#countReady"),
  countCompleted: $("#countCompleted"),
  countCancelled: $("#countCancelled"),
  addItemToggle: $("#addItemToggle"),
  addItemForm: $("#addItemForm"),
  cancelAddItem: $("#cancelAddItem"),
  newItemName: $("#newItemName"),
  newItemCategory: $("#newItemCategory"),
  newItemPrice: $("#newItemPrice"),
  newItemTag: $("#newItemTag"),
  newItemDescription: $("#newItemDescription"),
  categoryOptions: $("#categoryOptions"),
  menuAdminList: $("#menuAdminList"),
  customersList: $("#customersList"),
  customersNote: $("#customersNote"),
  settingsForm: $("#settingsForm"),
  settingsError: $("#settingsError"),
  settingsSaved: $("#settingsSaved"),
  hoursRows: $("#hoursRows"),
  editItemModal: $("#editItemModal"),
  editItemForm: $("#editItemForm"),
  editItemName: $("#editItemName"),
  editItemCategory: $("#editItemCategory"),
  editItemPrice: $("#editItemPrice"),
  editItemTag: $("#editItemTag"),
  editItemDescription: $("#editItemDescription"),
  editItemAvailable: $("#editItemAvailable"),
  editItemError: $("#editItemError"),
  adminToast: $("#adminToast"),
};

let autoRefreshTimer = null;
let toastTimer = null;
let savedTimer = null;

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

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return `${currencySymbol()}${number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDateLabel(value) {
  if (!value) return "—";
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

function formatPlaced(iso) {
  const date = new Date(iso);
  const today = startOfToday();
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  const diff = Math.round((dateOnly - today) / 86400000);
  const day =
    diff === 0
      ? "Today"
      : diff === -1
        ? "Yesterday"
        : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${day}, ${date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return formatPlaced(iso);
}

function showToast(message) {
  els.adminToast.textContent = message;
  els.adminToast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.adminToast.hidden = true;
  }, 3000);
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
    /* empty body */
  }
  if (response.status === 401) {
    showLogin();
    throw new Error("Your session expired. Please sign in again.");
  }
  if (!response.ok) {
    throw new Error(
      (data && data.error) || "Something went wrong. Please try again.",
    );
  }
  return data;
}

function showLogin() {
  els.app.hidden = true;
  els.loginScreen.hidden = false;
  els.loginPassword.value = "";
  els.loginError.hidden = true;
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  requestAnimationFrame(() => els.loginPassword.focus());
}

function applyBrand() {
  if (!state.settings) return;
  $$("[data-brand]").forEach((element) => {
    element.textContent = state.settings.bakeryName;
  });
  document.title = `Back office — ${state.settings.bakeryName}`;
}

async function enterApp() {
  els.loginScreen.hidden = true;
  els.app.hidden = false;
  await loadSettings();
  await setView("orders");
  if (!autoRefreshTimer) {
    autoRefreshTimer = setInterval(() => {
      if (
        !els.app.hidden &&
        state.view === "orders" &&
        document.visibilityState === "visible" &&
        els.editItemModal.hidden
      ) {
        refreshOrders(true);
      }
    }, 45000);
  }
}

async function loadSettings() {
  const data = await api("/api/admin/settings");
  state.settings = data.settings;
  applyBrand();
  fillSettingsForm();
}

let billMenu = [];

async function loadBilling() {
  try {
    const [menuData, billsData] = await Promise.all([
      api("/api/admin/menu"),
      api("/api/admin/bills"),
    ]);
    billMenu = menuData.menu || [];
    renderBillProducts(billMenu);
    renderBillList(billsData.bills || []);
  } catch (error) {
    showToast(error.message || "Couldn't load billing data.");
    renderBillProducts([]);
    renderBillList([]);
  }
}

function cartTotal() {
  let total = 0;
  let count = 0;
  for (const entry of billCart.values()) {
    total += entry.price * entry.qty;
    count += entry.qty;
  }
  return { total: round2(total), count };
}

function renderBillProducts(menu) {
  const query = $("#billSearch").value.toLowerCase();
  const filtered = menu.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query),
  );
  const html = filtered
    .map((item) => {
      const qty = billCart.get(item.id)?.qty || 0;
      return `
        <article class="product-card" data-id="${escapeAttr(item.id)}">
          <div class="product-name">${escapeHtml(item.name)}</div>
          <div class="product-meta"><span class="product-cat">${escapeHtml(item.category)}</span><span class="product-price">${formatMoney(item.price)}</span></div>
          <div class="product-controls">
            <button type="button" class="qty-minus" data-id="${escapeAttr(item.id)}">−</button>
            <span class="qty-value" data-qty-for="${escapeAttr(item.id)}">${qty}</span>
            <button type="button" class="qty-plus" data-id="${escapeAttr(item.id)}">+</button>
          </div>
        </article>`;
    })
    .join("");
  $("#billProducts").innerHTML = html || `<p style="color:#9a7e66;font-size:12px;padding:8mm 0;text-align:center;">No matching items</p>`;
  $$("#billProducts .qty-minus, #billProducts .qty-plus").forEach((button) => {
    button.addEventListener("click", () => {
      adjustBillQty(button.dataset.id, button.classList.contains("qty-plus") ? 1 : -1);
    });
  });
}

$("#billSearch").addEventListener("input", () => renderBillProducts(billMenu));

function adjustBillQty(id, change) {
  const item = billMenu.find((entry) => entry.id === id);
  if (!item) return;
  const entry = billCart.get(id);
  if (change > 0) {
    billCart.set(id, entry ? { ...entry, qty: entry.qty + 1 } : { id: item.id, name: item.name, category: item.category, price: item.price, qty: 1 });
  } else if (entry) {
    if (entry.qty > 1) billCart.set(id, { ...entry, qty: entry.qty - 1 });
    else billCart.delete(id);
  }
  renderBillProducts(billMenu);
  renderBillCart();
}

function renderBillCart() {
  const { total, count } = cartTotal();
  $("#billItemCount").textContent = count;
  $("#billTotal").textContent = `${state.settings?.currency || "₹"}${total}`;
  const rows = [...billCart.values()]
    .map((entry) => {
      const lineTotal = round2(entry.price * entry.qty);
      return `
        <tr>
          <td class="item-name">${escapeHtml(entry.name)}<div style="font-size:7.5px;color:#9a7e66;">${escapeHtml(entry.category)}</div></td>
          <td class="num">${formatMoney(entry.price)}</td>
          <td class="num"><button type="button" class="qty-minus" data-id="${escapeAttr(entry.id)}">−</button> ${entry.qty} <button type="button" class="qty-plus" data-id="${escapeAttr(entry.id)}">+</button></td>
          <td class="num">${formatMoney(lineTotal)}</td>
          <td><button type="button" class="remove-item" data-id="${escapeAttr(entry.id)}" title="Remove">×</button></td>
        </tr>`;
    })
    .join("");
  const tbody = $("#billRows");
  tbody.innerHTML = rows;
  $("#billEmpty").hidden = rows.length > 0;
  $("#billActions").hidden = rows.length === 0;
  tbody.querySelectorAll(".qty-minus, .qty-plus").forEach((button) => {
    button.addEventListener("click", () => {
      adjustBillQty(button.dataset.id, button.classList.contains("qty-plus") ? 1 : -1);
    });
  });
  tbody.querySelectorAll(".remove-item").forEach((button) => {
    button.addEventListener("click", () => {
      billCart.delete(button.dataset.id);
      renderBillProducts(billMenu);
      renderBillCart();
    });
  });
}

async function saveBill() {
  const items = [...billCart.values()].map((entry) => ({
    menuItemId: entry.id,
    name: entry.name,
    category: entry.category,
    price: entry.price,
    qty: entry.qty,
  }));
  const { total, count } = cartTotal();
  try {
    const data = await api("/api/admin/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        total,
        itemCount: count,
        customerName: $("#billCustomerName").value.trim(),
        customerPhone: $("#billCustomerPhone").value.trim(),
      }),
    });
    showToast(`Bill ${data.bill.code} saved`);
    billCart.clear();
    renderBillProducts(billMenu);
    renderBillCart();
    $("#billCustomerName").value = "";
    $("#billCustomerPhone").value = "";
    await loadBilling();
  } catch (error) {
    showToast(error.message || "Couldn't save the bill.");
  }
}

function renderBillList(bills) {
  const html = bills
    .slice(0, 20)
    .map((bill) => {
      const itemsLine = bill.items.map((e) => `${e.qty}× ${escapeHtml(e.name)}`).join(", ");
      return `
        <div class="bill-row">
          <div class="bill-row-meta">
            <div class="bill-row-code">${escapeHtml(bill.code)}</div>
            <div class="bill-row-date">${formatDateLabel(bill.createdAt)}</div>
            ${bill.customerName ? `<div style="font-size:8px;color:#9a7e66;">${escapeHtml(bill.customerName)}</div>` : ""}
            <div style="font-size:8px;color:#9a7e66;">${itemsLine}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700;font-family:Fraunces,serif;">${formatMoney(bill.total)}</div>
            <a href="/bill/${escapeAttr(bill.id)}" target="_blank" rel="noopener" class="btn btn-ghost btn-small" style="padding:1mm 3mm;font-size:8px;">View · Print</a>
          </div>
        </div>`;
    })
    .join("");
  $("#billList").innerHTML = html || `<p style="color:#9a7e66;font-size:12px;text-align:center;padding:6mm 0;">No bills yet</p>`;
}

async function refreshOrders(silent = false) {
  try {
    const [summaryData, ordersData] = await Promise.all([
      api("/api/admin/summary"),
      api("/api/admin/orders"),
    ]);
    state.summary = summaryData;
    state.orders = ordersData.orders;
    renderStats();
    renderFilterCounts();
    renderOrders();
    updateOrdersNote();
    if (!silent) showToast("Orders are up to date");
  } catch (error) {
    if (!silent) showToast(error.message);
  }
}

function renderStats() {
  if (!state.summary) {
    els.statsGrid.innerHTML = "";
    return;
  }
  const stats = state.summary.stats;
  const cards = [
    {
      label: "Orders today",
      value: String(stats.ordersToday),
      meta: "Placed since midnight",
    },
    {
      label: "Revenue today",
      value: formatMoney(stats.revenueToday),
      meta: "Excluding cancelled orders",
      accent: true,
    },
    {
      label: "To prepare",
      value: String(stats.pending),
      meta: "New and ready orders",
    },
    {
      label: "Pickups today",
      value: String(stats.pickupsToday),
      meta: "Still waiting to be collected",
    },
  ];
  els.statsGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="stat${card.accent ? " accent" : ""}">
          <span class="stat-label">${card.label}</span>
          <strong class="stat-value">${card.value}</strong>
          <p class="stat-meta">${card.meta}</p>
        </div>`,
    )
    .join("");
}

function renderFilterCounts() {
  if (!state.summary) return;
  const counts = state.summary.counts;
  const total =
    (counts.new || 0) +
    (counts.ready || 0) +
    (counts.completed || 0) +
    (counts.cancelled || 0);
  els.countAll.textContent = String(total);
  els.countNew.textContent = String(counts.new || 0);
  els.countReady.textContent = String(counts.ready || 0);
  els.countCompleted.textContent = String(counts.completed || 0);
  els.countCancelled.textContent = String(counts.cancelled || 0);

  const badge = els.newOrderBadge;
  if (counts.new > 0) {
    badge.textContent = String(counts.new);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function updateOrdersNote() {
  const visible = state.orders.filter((order) =>
    state.filter === "all" ? true : order.status === state.filter,
  ).length;
  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  els.ordersNote.textContent = `Showing ${visible} order${
    visible === 1 ? "" : "s"
  } · Updated ${time}`;
}

function waNumber(phone) {
  let digits = String(phone).replace(/\D/g, "");
  const countryCode = state.settings?.countryCode || "91";
  if (digits.length === 10) digits = `${countryCode}${digits}`;
  return digits;
}

function formatPhone(phone) {
  const digits = waNumber(phone);
  const countryCode = state.settings?.countryCode || "91";
  if (digits.startsWith(countryCode) && digits.length === countryCode.length + 10) {
    const local = digits.slice(countryCode.length);
    return `+${countryCode} ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return `+${digits}`;
}

function whatsappLink(order) {
  const phone = waNumber(order.customer.phone);
  const firstName = order.customer.name.trim().split(/\s+/)[0];
  const pickup = `${formatDateLabel(order.pickupDate)}, ${order.slot}`;
  const bakery = state.settings?.bakeryName || "the bakery";
  const messages = {
    new: `Hi ${firstName}, thanks for order ${order.code}! We've got it and will have it ready for pickup ${pickup}. — ${bakery}`,
    ready: `Hi ${firstName}, your order ${order.code} is ready for pickup (${pickup}). See you soon! — ${bakery}`,
    completed: `Hi ${firstName}, thank you for picking up ${order.code}. Hope every bite was worth it! — ${bakery}`,
    cancelled: `Hi ${firstName}, we're sorry — we can't fulfil order ${order.code}. We'll be in touch about a refund or alternative. — ${bakery}`,
  };
  return `https://wa.me/${phone}?text=${encodeURIComponent(
    messages[order.status] || messages.new,
  )}`;
}

function orderActions(order) {
  const buttons = [];
  if (order.status === "new") {
    buttons.push(
      `<button class="btn btn-primary" type="button" data-status="ready">Mark ready</button>`,
    );
    buttons.push(
      `<button class="btn btn-danger-ghost" type="button" data-status="cancelled">Cancel</button>`,
    );
  } else if (order.status === "ready") {
    buttons.push(
      `<button class="btn btn-success" type="button" data-status="completed">Picked up</button>`,
    );
    buttons.push(
      `<button class="btn btn-danger-ghost" type="button" data-status="cancelled">Cancel</button>`,
    );
  } else if (order.status === "cancelled") {
    buttons.push(
      `<button class="btn btn-ghost" type="button" data-status="new">Restore</button>`,
    );
  }
  buttons.push(
    `<a class="btn btn-ghost" href="${whatsappLink(
      order,
    )}" target="_blank" rel="noopener">Message</a>`,
  );
  return buttons.join("");
}

function orderCard(order) {
  const items = order.items
    .map(
      (item) => `
        <li>
          <span>${item.qty} × ${escapeHtml(item.name)}</span>
          <span>${formatMoney(item.price * item.qty)}</span>
        </li>`,
    )
    .join("");

  const cake = order.cake
    ? `<div class="cake-block">
        ${
          order.cake.referenceImage
            ? `<a href="${escapeAttr(
                order.cake.referenceImage,
              )}" target="_blank" rel="noopener"><img class="cake-photo" src="${escapeAttr(
                order.cake.referenceImage,
              )}" alt="Cake reference" loading="lazy" /></a>`
            : ""
        }
        <div class="cake-copy">
          <strong>Custom cake request</strong>
          ${escapeHtml(order.cake.description)}
        </div>
      </div>`
    : "";

  const notes = order.notes
    ? `<div class="order-note"><strong>Kitchen notes</strong>${escapeHtml(
        order.notes,
      )}</div>`
    : "";

  const footNotes = {
    new: "Awaiting confirmation",
    ready: "Ready for pickup",
    completed: "Picked up · loyalty stamp added",
    cancelled: "Cancelled · no stamp awarded",
  };

  return `
    <article class="order-card status-${order.status}" data-order-id="${escapeAttr(
      order.id,
    )}">
      <div class="order-head">
        <div class="order-code-block">
          <strong>${escapeHtml(order.code)}</strong>
          <span>${timeAgo(order.createdAt)}</span>
        </div>
        <span class="status-pill ${order.status}">${STATUS_LABELS[order.status]}</span>
      </div>
      <div class="order-grid">
        <div class="order-col">
          <h3 class="customer-name">${escapeHtml(order.customer.name)}</h3>
          <a class="customer-phone" href="tel:+${escapeAttr(
            waNumber(order.customer.phone),
          )}">${escapeHtml(formatPhone(order.customer.phone))}</a>
          <ul class="order-items">
            ${items}
            ${
              order.cake
                ? `<li><span>Custom cake request</span><span>${
                    order.items.length === 0 ? "Quote" : "Added"
                  }</span></li>`
                : ""
            }
          </ul>
          <div class="order-total">
            <span>${order.items.length === 0 ? "Cake quote" : "Total"}</span>
            <strong>${
              order.items.length === 0 ? "To follow" : formatMoney(order.total)
            }</strong>
          </div>
        </div>
        <div class="order-col order-meta">
          <div>
            <span class="meta-label">Pickup</span>
            <span class="meta-value">${escapeHtml(
              formatDateLabel(order.pickupDate),
            )}<br />${escapeHtml(order.slot)}</span>
          </div>
          <div>
            <span class="meta-label">Placed</span>
            <span class="meta-value">${formatPlaced(order.createdAt)}</span>
          </div>
          ${cake}
          ${notes}
        </div>
      </div>
      <div class="order-foot">
        <span class="order-foot-note">${footNotes[order.status]}</span>
        <div class="order-actions">${orderActions(order)}</div>
      </div>
    </article>`;
}

function renderOrders() {
  if (!state.summary) {
    els.ordersList.innerHTML = `<div class="empty-admin"><strong>Loading orders…</strong></div>`;
    return;
  }

  const priority = { new: 0, ready: 1, completed: 2, cancelled: 3 };
  const filtered = state.orders
    .filter((order) =>
      state.filter === "all" ? true : order.status === state.filter,
    )
    .sort(
      (a, b) =>
        (priority[a.status] ?? 9) - (priority[b.status] ?? 9) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  if (filtered.length === 0) {
    els.ordersList.innerHTML = `<div class="empty-admin">
      <strong>All quiet</strong>
      ${
        state.filter === "all"
          ? "No pickup orders yet. New orders will appear here automatically."
          : `No ${STATUS_LABELS[state.filter].toLowerCase()} orders right now.`
      }
    </div>`;
    return;
  }

  els.ordersList.innerHTML = filtered.map(orderCard).join("");
}

async function updateOrderStatus(orderId, status) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) return;

  if (status === "completed") {
    const confirmed = window.confirm(
      `Mark ${order.code} as picked up?\n\nThis adds one loyalty stamp for ${order.customer.name}.`,
    );
    if (!confirmed) return;
  }
  if (status === "cancelled") {
    const confirmed = window.confirm(
      `Cancel ${order.code} for ${order.customer.name}?\n\nNo loyalty stamp will be awarded.`,
    );
    if (!confirmed) return;
  }

  try {
    await api(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    const messages = {
      ready: `${order.code} marked ready`,
      completed: `${order.code} picked up — stamp added`,
      cancelled: `${order.code} cancelled`,
      new: `${order.code} restored`,
    };
    showToast(messages[status] || "Order updated");
    await refreshOrders(true);
  } catch (error) {
    showToast(error.message);
  }
}

async function setView(view) {
  state.view = view;
  $$(".side-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  $$(".view").forEach((section) => {
    section.hidden = section.id !== `view-${view}`;
  });
  els.viewTitle.textContent = VIEW_TITLES[view] || "Dashboard";

  try {
    if (view === "orders") {
      await refreshOrders(true);
    } else if (view === "menu") {
      await loadMenu();
    } else if (view === "customers") {
      await loadCustomers();
    } else if (view === "settings") {
      await loadSettings();
      els.settingsError.hidden = true;
    } else if (view === "billing") {
      await loadBilling();
    }
  } catch (error) {
    showToast(error.message);
  }
}

$("#saveBill").addEventListener("click", saveBill);
$("#clearBill").addEventListener("click", () => {
  billCart.clear();
  renderBillProducts(billMenu);
  renderBillCart();
});

async function loadMenu() {
  const data = await api("/api/admin/menu");
  state.menu = data.menu;
  renderMenuAdmin();
  populateCategories();
}

function populateCategories() {
  const categories = [...new Set(state.menu.map((item) => item.category))];
  els.categoryOptions.innerHTML = categories
    .map((category) => `<option value="${escapeAttr(category)}"></option>`)
    .join("");
}

function renderMenuAdmin() {
  if (state.menu.length === 0) {
    els.menuAdminList.innerHTML = `<div class="empty-admin">
      <strong>No items yet</strong>
      Add your first bake to start taking orders.
    </div>`;
    return;
  }

  els.menuAdminList.innerHTML = state.menu
    .map(
      (item) => `
        <div class="menu-admin-row" data-id="${escapeAttr(item.id)}">
          <div class="menu-meta">
            <span class="menu-cat">${escapeHtml(item.category)}</span>
            <div class="menu-name">
              ${escapeHtml(item.name)}
              ${
                item.tag
                  ? `<span class="menu-tag">${escapeHtml(item.tag)}</span>`
                  : ""
              }
            </div>
            <div class="menu-desc">${escapeHtml(
              item.description || "No description",
            )}</div>
          </div>
          <label class="menu-price">
            ${currencySymbol()}
            <input type="number" min="0" max="500000" step="1" value="${
              item.price
            }" data-price aria-label="Price for ${escapeAttr(item.name)}" />
          </label>
          <label class="mini-toggle">
            <input type="checkbox" data-available ${
              item.available ? "checked" : ""
            } />
            <span></span>
            ${item.available ? "Available" : "Sold out"}
          </label>
          <div class="menu-row-actions">
            <button class="mini-button" type="button" data-edit>Edit</button>
            <button class="mini-button danger" type="button" data-delete>Delete</button>
          </div>
        </div>`,
    )
    .join("");
}

function openEditItem(item) {
  state.editingItemId = item.id;
  els.editItemName.value = item.name;
  els.editItemCategory.value = item.category;
  els.editItemPrice.value = item.price;
  els.editItemTag.value = item.tag || "";
  els.editItemDescription.value = item.description || "";
  els.editItemAvailable.checked = Boolean(item.available);
  els.editItemError.hidden = true;
  els.editItemModal.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => els.editItemName.focus());
}

function closeEditItem() {
  state.editingItemId = null;
  els.editItemModal.hidden = true;
  document.body.style.overflow = "";
}

async function loadCustomers() {
  const data = await api("/api/admin/customers");
  state.customers = data.customers;
  renderCustomers();
}

function renderCustomers() {
  els.customersNote.textContent = `${state.customers.length} customer${
    state.customers.length === 1 ? "" : "s"
  }`;

  if (state.customers.length === 0) {
    els.customersList.innerHTML = `<div class="empty-admin">
      <strong>No customers yet</strong>
      Customers appear here after their first pickup order.
    </div>`;
    return;
  }

  const rows = state.customers
    .map((customer) => {
      const percent = Math.min(
        100,
        Math.round((customer.stamps / customer.target) * 100),
      );
      return `
        <tr data-phone="${escapeAttr(customer.phone)}">
          <td>
            <div class="customer-name-cell">
              <strong>${escapeHtml(customer.name)}</strong>
              <span>${escapeHtml(formatPhone(customer.phone))}</span>
            </div>
          </td>
          <td>${customer.orders}</td>
          <td>${formatMoney(customer.totalSpent)}</td>
          <td>${escapeHtml(formatDateLabel(customer.lastPickupDate))}</td>
          <td class="stamp-cell">
            <strong>${customer.stamps} / ${customer.target}</strong>
            ${
              customer.rewardsReady > 0
                ? `<span class="reward-ready">${customer.rewardsReady} ready</span>`
                : ""
            }
            <div class="progress"><span style="width:${percent}%"></span></div>
          </td>
          <td>
            <div class="table-actions">
              ${
                customer.rewardsReady > 0
                  ? `<button class="mini-button" type="button" data-redeem>Redeem</button>`
                  : ""
              }
              <a class="mini-button" href="https://wa.me/${waNumber(
                customer.phone,
              )}?text=${encodeURIComponent(
                `Hi ${customer.name.trim().split(/\s+/)[0]}! A little note from ${
                  state.settings?.bakeryName || "the bakery"
                }.`,
              )}" target="_blank" rel="noopener">Message</a>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  els.customersList.innerHTML = `
    <table class="customer-table">
      <thead>
        <tr>
          <th>Customer</th>
          <th>Orders</th>
          <th>Spent</th>
          <th>Last pickup</th>
          <th>Loyalty</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function addHoursRow(label = "", value = "") {
  const row = document.createElement("div");
  row.className = "hours-row";
  row.innerHTML = `
    <input type="text" maxlength="40" placeholder="Tuesday – Sunday" aria-label="Hours label" value="${escapeAttr(
      label,
    )}" data-hours-label />
    <input type="text" maxlength="40" placeholder="8:00 am – 8:00 pm" aria-label="Hours value" value="${escapeAttr(
      value,
    )}" data-hours-value />
    <button class="remove-hours" type="button" aria-label="Remove hours row">×</button>`;
  els.hoursRows.appendChild(row);
}

function fillSettingsForm() {
  const settings = state.settings;
  if (!settings) return;
  $("#setBakeryName").value = settings.bakeryName || "";
  $("#setOrderPrefix").value = settings.orderPrefix || "";
  $("#setTagline").value = settings.tagline || "";
  $("#setStory").value = settings.story || "";
  $("#setAddress").value = settings.address || "";
  $("#setPhoneDisplay").value = settings.phoneDisplay || "";
  $("#setWhatsapp").value = settings.whatsapp || "";
  $("#setInstagram").value = settings.instagram || "";
  $("#setCurrency").value = settings.currency || "";
  $("#setCountryCode").value = settings.countryCode || "";
  $("#setLoyaltyTarget").value = settings.loyaltyTarget || 10;
  $("#setLoyaltyBlurb").value = settings.loyaltyBlurb || "";
  $("#setSlots").value = (settings.slots || []).join("\n");
  $("#setClosedWeekdays").value = (settings.closedWeekdays || []).join(", ");
  $("#setNotice").value = settings.notice || "";
  els.hoursRows.innerHTML = "";
  for (const row of settings.hours || []) {
    addHoursRow(row.label, row.value);
  }
  if (els.hoursRows.children.length === 0) addHoursRow();
  els.settingsSaved.hidden = true;
}

async function saveSettings(event) {
  event.preventDefault();
  els.settingsError.hidden = true;
  els.settingsSaved.hidden = true;

  const hours = [];
  let invalidHours = false;
  for (const row of $$(".hours-row", els.hoursRows)) {
    const label = $("[data-hours-label]", row).value.trim();
    const value = $("[data-hours-value]", row).value.trim();
    if (!label && !value) continue;
    if (!label || !value) {
      invalidHours = true;
      break;
    }
    hours.push({ label, value });
  }
  if (invalidHours || hours.length === 0) {
    els.settingsError.textContent =
      "Complete both fields in each opening-hours row (or remove the empty row).";
    els.settingsError.hidden = false;
    return;
  }

  const slots = $("#setSlots")
    .value.split("\n")
    .map((slot) => slot.trim())
    .filter(Boolean);

  const closedWeekdays = $("#setClosedWeekdays")
    .value.split(",")
    .map((day) => day.trim())
    .filter(Boolean)
    .map((day) => Number(day));

  const payload = {
    bakeryName: $("#setBakeryName").value,
    orderPrefix: $("#setOrderPrefix").value,
    tagline: $("#setTagline").value,
    story: $("#setStory").value,
    address: $("#setAddress").value,
    phoneDisplay: $("#setPhoneDisplay").value,
    whatsapp: $("#setWhatsapp").value,
    instagram: $("#setInstagram").value,
    currency: $("#setCurrency").value,
    countryCode: $("#setCountryCode").value,
    loyaltyTarget: Number($("#setLoyaltyTarget").value),
    loyaltyBlurb: $("#setLoyaltyBlurb").value,
    notice: $("#setNotice").value,
    slots,
    closedWeekdays,
    hours,
  };

  try {
    const data = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    state.settings = data.settings;
    applyBrand();
    fillSettingsForm();
    els.settingsSaved.hidden = false;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      els.settingsSaved.hidden = true;
    }, 4000);
    showToast("Settings saved");
  } catch (error) {
    els.settingsError.textContent = error.message;
    els.settingsError.hidden = false;
  }
}

function bindEvents() {
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.loginError.hidden = true;
    els.loginButton.disabled = true;
    els.loginButton.textContent = "Signing in…";
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: els.loginPassword.value }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((data && data.error) || "Could not sign in.");
      }
      els.loginPassword.value = "";
      await enterApp();
    } catch (error) {
      els.loginError.textContent = error.message;
      els.loginError.hidden = false;
    } finally {
      els.loginButton.disabled = false;
      els.loginButton.textContent = "Sign in";
    }
  });

  $$(".side-link").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  els.refreshButton.addEventListener("click", async () => {
    if (state.view === "orders") {
      await refreshOrders();
    } else if (state.view === "menu") {
      await loadMenu();
      showToast("Menu refreshed");
    } else if (state.view === "customers") {
      await loadCustomers();
      showToast("Customers refreshed");
    } else if (state.view === "settings") {
      await loadSettings();
      showToast("Settings refreshed");
    }
  });

  $("#logoutButton").addEventListener("click", async () => {
    try {
      await api("/api/admin/logout", { method: "POST" });
    } catch {
      /* already signed out */
    }
    showLogin();
  });

  els.orderFilters.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-filter]");
    if (!tab) return;
    state.filter = tab.dataset.filter;
    $$(".filter-tab", els.orderFilters).forEach((button) => {
      button.classList.toggle("active", button === tab);
    });
    renderOrders();
    updateOrdersNote();
  });

  els.ordersList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) return;
    const card = button.closest("[data-order-id]");
    if (!card) return;
    updateOrderStatus(card.dataset.orderId, button.dataset.status);
  });

  els.addItemToggle.addEventListener("click", () => {
    els.addItemForm.hidden = !els.addItemForm.hidden;
    if (!els.addItemForm.hidden) {
      els.newItemName.focus();
    }
  });

  els.cancelAddItem.addEventListener("click", () => {
    els.addItemForm.hidden = true;
    els.addItemForm.reset();
  });

  els.addItemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/admin/menu", {
        method: "POST",
        body: JSON.stringify({
          name: els.newItemName.value,
          category: els.newItemCategory.value,
          price: Number(els.newItemPrice.value),
          tag: els.newItemTag.value,
          description: els.newItemDescription.value,
          available: true,
        }),
      });
      els.addItemForm.reset();
      els.addItemForm.hidden = true;
      showToast("Item added to the menu");
      await loadMenu();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.menuAdminList.addEventListener("change", async (event) => {
    const row = event.target.closest(".menu-admin-row");
    if (!row) return;
    const id = row.dataset.id;
    const item = state.menu.find((entry) => entry.id === id);
    if (!item) return;

    try {
      if (event.target.matches("[data-price]")) {
        const price = Number(event.target.value);
        const data = await api(`/api/admin/menu/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ price }),
        });
        state.menu = state.menu.map((entry) =>
          entry.id === id ? data.item : entry,
        );
        showToast(`${data.item.name} price updated`);
      } else if (event.target.matches("[data-available]")) {
        const available = event.target.checked;
        await api(`/api/admin/menu/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ available }),
        });
        await loadMenu();
        showToast(
          `${item.name} marked ${available ? "available" : "sold out"}`,
        );
      }
    } catch (error) {
      showToast(error.message);
      renderMenuAdmin();
    }
  });

  els.menuAdminList.addEventListener("click", async (event) => {
    const row = event.target.closest(".menu-admin-row");
    if (!row) return;
    const item = state.menu.find((entry) => entry.id === row.dataset.id);
    if (!item) return;

    if (event.target.closest("[data-edit]")) {
      openEditItem(item);
      return;
    }

    if (event.target.closest("[data-delete]")) {
      const confirmed = window.confirm(
        `Delete “${item.name}” from the menu?\n\nPast orders are not affected.`,
      );
      if (!confirmed) return;
      try {
        await api(`/api/admin/menu/${item.id}`, { method: "DELETE" });
        showToast(`${item.name} removed`);
        await loadMenu();
      } catch (error) {
        showToast(error.message);
      }
    }
  });

  $("#closeEditItem").addEventListener("click", closeEditItem);
  $("#cancelEditItem").addEventListener("click", closeEditItem);
  els.editItemModal.addEventListener("click", (event) => {
    if (event.target === els.editItemModal) closeEditItem();
  });

  els.editItemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.editingItemId) return;
    els.editItemError.hidden = true;
    try {
      await api(`/api/admin/menu/${state.editingItemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: els.editItemName.value,
          category: els.editItemCategory.value,
          price: Number(els.editItemPrice.value),
          tag: els.editItemTag.value,
          description: els.editItemDescription.value,
          available: els.editItemAvailable.checked,
        }),
      });
      closeEditItem();
      showToast("Menu item saved");
      await loadMenu();
    } catch (error) {
      els.editItemError.textContent = error.message;
      els.editItemError.hidden = false;
    }
  });

  els.customersList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-redeem]");
    if (!button) return;
    const row = button.closest("[data-phone]");
    const customer = state.customers.find(
      (entry) => entry.phone === row.dataset.phone,
    );
    if (!customer) return;
    const confirmed = window.confirm(
      `Redeem a free-bake reward for ${customer.name}?\n\nThis clears ${customer.target} stamps from their card.`,
    );
    if (!confirmed) return;
    try {
      await api(
        `/api/admin/customers/${encodeURIComponent(customer.phone)}/redeem`,
        { method: "POST" },
      );
      showToast(`Reward redeemed for ${customer.name}`);
      await loadCustomers();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.settingsForm.addEventListener("submit", saveSettings);

  $("#addHoursRow").addEventListener("click", () => addHoursRow());

  els.hoursRows.addEventListener("click", (event) => {
    const remove = event.target.closest(".remove-hours");
    if (!remove) return;
    const rows = $$(".hours-row", els.hoursRows);
    if (rows.length === 1) {
      $("[data-hours-label]", rows[0]).value = "";
      $("[data-hours-value]", rows[0]).value = "";
      return;
    }
    remove.closest(".hours-row").remove();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.editItemModal.hidden) {
      closeEditItem();
    }
  });
}

function init() {
  els.todayLabel.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  bindEvents();

  fetch("/api/admin/session")
    .then((response) => response.json())
    .then((data) => {
      if (data.authenticated) return enterApp();
      return null;
    })
    .catch(() => {
      els.loginError.textContent =
        "Could not reach the server. Check your connection and refresh.";
      els.loginError.hidden = false;
    });
}

init();
