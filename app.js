const STORAGE_KEY = "kirana-os-ai-v1";
const seed = { products: [], sales: [] };
let state = loadState();
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.products) && Array.isArray(saved.sales)) return saved;
  } catch (error) { console.warn("Could not read saved store data.", error); }
  return structuredClone(seed);
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { showToast("Could not save data on this device."); }
}
function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}
function todayKey() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}
function openModal(id) {
  document.getElementById(id).hidden = false;
  const first = document.querySelector("#" + id + " input, #" + id + " select");
  if (first) setTimeout(() => first.focus(), 50);
}
function closeModal(id) { document.getElementById(id).hidden = true; }

function render() {
  const low = state.products.filter(p => p.quantity <= p.threshold);
  const totalValue = state.products.reduce((sum,p) => sum + p.price * p.quantity, 0);
  const todaysSales = state.sales.filter(s => s.date === todayKey());
  const revenue = todaysSales.reduce((sum,s) => sum + s.total, 0);
  document.getElementById("total-products").textContent = state.products.length;
  document.getElementById("stock-value").textContent = money(totalValue);
  document.getElementById("today-sales").textContent = money(revenue);
  document.getElementById("low-stock").textContent = low.length;
  document.getElementById("sales-count").textContent = todaysSales.length + (todaysSales.length === 1 ? " transaction today" : " transactions today");
  document.getElementById("nav-stock-count").textContent = state.products.length;
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date());

  const body = document.getElementById("inventory-body");
  body.innerHTML = state.products.slice(0,5).map(p => {
    const isLow = p.quantity <= p.threshold;
    return '<tr><td><div class="product-cell"><span class="product-thumb">▦</span>' + escapeHtml(p.name) + '</div></td><td>' + money(p.price) + '</td><td>' + p.quantity + '</td><td><span class="status ' + (isLow ? "low" : "good") + '">' + (isLow ? "Low stock" : "In stock") + '</span></td></tr>';
  }).join("");
  document.getElementById("inventory-empty").hidden = state.products.length > 0;
  document.querySelector(".table-wrap").hidden = state.products.length === 0;
  document.getElementById("stock-insight").textContent = state.products.length ? (low.length ? low.length + " of " + state.products.length + " products are at or below their low-stock threshold." : "All " + state.products.length + " products are above their low-stock thresholds.") : "Add products to see your store health summary.";
  document.getElementById("attention-insight").textContent = low.length ? low.map(p => p.name).slice(0,3).join(", ") + (low.length > 3 ? " and more" : "") + " need restocking." : "No low-stock products right now.";
  document.getElementById("activity-insight").textContent = todaysSales.length ? todaysSales.length + " sales recorded today, totalling " + money(revenue) + "." : "No sales recorded today. Your first sale will appear here.";
  renderSales();
  renderSaleOptions();
}
function renderSales() {
  const list = document.getElementById("sales-list");
  const recent = [...state.sales].reverse().slice(0,4);
  list.innerHTML = recent.map(s => '<div class="sale-row"><span class="sale-symbol">↗</span><div class="sale-detail"><b>' + escapeHtml(s.productName) + ' · ' + s.quantity + ' sold</b><small>' + new Date(s.createdAt).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) + '</small></div><strong class="sale-amount">' + money(s.total) + '</strong></div>').join("");
  document.getElementById("sales-empty").hidden = recent.length > 0;
}
function renderSaleOptions() {
  const select = document.getElementById("sale-product");
  const available = state.products.filter(p => p.quantity > 0);
  select.innerHTML = available.length ? available.map(p => '<option value="' + p.id + '">' + escapeHtml(p.name) + ' (' + p.quantity + ' available)</option>').join("") : '<option value="">No products with stock</option>';
  select.disabled = available.length === 0;
  updateSaleAvailable();
}
function updateSaleAvailable() {
  const product = state.products.find(p => p.id === document.getElementById("sale-product").value);
  document.getElementById("sale-available").textContent = product ? product.quantity + " units available · " + money(product.price) + " per unit" : "Add a product with available stock first.";
}
document.getElementById("product-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("name")).trim();
  const price = Number(data.get("price"));
  const quantity = Number(data.get("quantity"));
  const threshold = Number(data.get("threshold"));
  const error = document.getElementById("product-error");
  if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(threshold) || threshold < 0) {
    error.textContent = "Please enter valid product details."; return;
  }
  if (state.products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    error.textContent = "This product already exists. Use a unique name."; return;
  }
  state.products.push({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, price, quantity, threshold});
  saveState(); render(); form.reset(); closeModal("product-modal"); error.textContent = ""; showToast("Product added to inventory.");
});
document.getElementById("sale-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const product = state.products.find(p => p.id === new FormData(form).get("productId"));
  const quantity = Number(new FormData(form).get("quantity"));
  const error = document.getElementById("sale-error");
  if (!product || !Number.isInteger(quantity) || quantity < 1) { error.textContent = "Select a product and enter a valid quantity."; return; }
  if (quantity > product.quantity) { error.textContent = "Not enough stock. Only " + product.quantity + " available."; return; }
  product.quantity -= quantity;
  state.sales.push({id: String(Date.now()), productName: product.name, quantity, total: product.price * quantity, date: todayKey(), createdAt: new Date().toISOString()});
  saveState(); render(); form.reset(); closeModal("sale-modal"); error.textContent = ""; showToast("Sale recorded and stock updated.");
});
document.getElementById("sale-product").addEventListener("change", updateSaleAvailable);
document.getElementById("add-product-open").addEventListener("click", () => openModal("product-modal"));
document.getElementById("empty-add").addEventListener("click", () => openModal("product-modal"));
document.getElementById("record-sale-open").addEventListener("click", () => {
  if (!state.products.some(p => p.quantity > 0)) { showToast("Add a product with stock before recording a sale."); return; }
  openModal("sale-modal");
});
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeModal(button.dataset.close)));
document.querySelectorAll(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(backdrop.id); }));
document.getElementById("mobile-menu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => {
  document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
  link.classList.add("active");
  document.getElementById("sidebar").classList.remove("open");
}));
document.getElementById("view-inventory").addEventListener("click", () => document.getElementById("inventory").scrollIntoView({behavior:"smooth"}));
render();