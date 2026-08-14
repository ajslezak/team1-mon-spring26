const status = document.querySelector("#status");
const count = document.querySelector("#count");
const details = document.querySelector("#details");
const search = document.querySelector("#search");
const authMessage = document.querySelector("#status");
const supabaseModule = await import("https://esm.sh/@supabase/supabase-js@2");
const config = await fetch("/api/config").then((r) => r.json());
const auth = supabaseModule.createClient(config.url, config.key);
let session = null;
let chatChannel = null;
auth.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; updateAuthUi(); });
session = (await auth.auth.getSession()).data.session;

function updateAuthUi() {
  document.querySelector("#login").hidden = Boolean(session);
  document.querySelector("#signup").hidden = Boolean(session);
  document.querySelector("#logout").hidden = !session;
  document.querySelector("#email").hidden = Boolean(session);
  document.querySelector("#password").hidden = Boolean(session);
  authMessage.textContent = session ? `Signed in as ${session.user.email}` : "Not signed in";
  if (session) loadChats(); else document.querySelector("#chat-panel").hidden = true;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...options, headers });
}
const map = L.map("map", { zoomControl: true }).setView([40.73, -73.99], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

let amenities = [];
const markers = L.layerGroup().addTo(map);
const bikeRackMarkers = L.markerClusterGroup({
  chunkedLoading: true,
  maxClusterRadius: 55,
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  disableClusteringAtZoom: 17,
  iconCreateFunction: (cluster) => {
    const count = cluster.getChildCount();
    const size = count < 10 ? "small" : count < 100 ? "medium" : "large";
    return L.divIcon({ html: `<div class="bike-cluster bike-cluster-${size}">${count}</div>`, className: "bike-cluster-wrapper", iconSize: [42, 42] });
  },
}).addTo(map);
const enabledTypes = new Set();
let viewportLoadTimer = null;
const savedTypes = JSON.parse(localStorage.getItem("amenity-enabled-types") || "null");
let hasSavedTypePreference = Array.isArray(savedTypes);
if (Array.isArray(savedTypes)) savedTypes.forEach((type) => enabledTypes.add(type));
if (localStorage.getItem("amenity-show-inactive") === "true") document.querySelector("#inactive").checked = true;
if (localStorage.getItem("amenity-accessible-only") === "true") document.querySelector("#accessible").checked = true;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
}[c]));

function renderMarkers() {
  markers.clearLayers();
  bikeRackMarkers.clearLayers();
  const term = search.value.trim().toLowerCase();
  const visible = amenities.filter((a) => { const type = Array.isArray(a.amenity_types) ? a.amenity_types[0] : a.amenity_types; return enabledTypes.has(type?.name) && (document.querySelector("#inactive").checked || a.active !== false) && (!document.querySelector("#accessible").checked || Boolean(a.accessibility)) && (!term || `${a.name} ${a.address ?? ""}`.toLowerCase().includes(term)); });
  visible.forEach((amenity) => {
    const type = Array.isArray(amenity.amenity_types) ? amenity.amenity_types[0] : amenity.amenity_types;
    const label = type?.name || "";
    const emoji = label.toLowerCase().includes("restroom") ? "🚻" : label.toLowerCase().includes("fountain") ? "💧" : label.toLowerCase().includes("bike") ? "🚲" : label.toLowerCase().includes("cooling") ? "❄️" : label.toLowerCase().includes("linknyc") ? "📶" : "📍";
    const marker = L.marker([amenity.latitude, amenity.longitude], { icon: L.divIcon({ className: "amenity-emoji-marker", html: `<span style="--marker-color:${escapeHtml(type?.color || "#3388ff")}"><b>${emoji}</b></span>`, iconSize: [34, 38], iconAnchor: [17, 34], popupAnchor: [0, -32] }) });
    marker.bindTooltip(amenity.name);
    marker.on("click", async () => {
      details.hidden = false;
      details.innerHTML = `<h2>${escapeHtml(amenity.name)}</h2><p>${escapeHtml(type?.name || "Amenity")}</p><p>${escapeHtml(amenity.address || "")}</p><p>${escapeHtml(amenity.description || "")}</p><button id="available">Report available</button> <button id="unavailable">Report unavailable</button><p id="availability">Loading availability…</p>`;
      api(`/api/amenities/${encodeURIComponent(amenity.id)}/availability`).then(r => r.json()).then(x => { document.querySelector("#availability").textContent = `${x.available} available, ${x.unavailable} unavailable reports`; });
      for (const [id, value] of [["available", true], ["unavailable", false]]) document.querySelector(`#${id}`).addEventListener("click", async () => { const r = await api(`/api/amenities/${encodeURIComponent(amenity.id)}/availability/report`, { method: "POST", body: JSON.stringify({ is_available: value }) }); if (r.ok) document.querySelector("#availability").textContent = "Thanks—your report was recorded."; });
      const detail = await api(`/api/amenities/${encodeURIComponent(amenity.id)}`);
      const detailData = await detail.json();
      const favorite = detailData.favorite;
      details.insertAdjacentHTML("beforeend", `<button id="favorite">${favorite ? "Remove favorite" : "Save favorite"}</button><h3>Reviews</h3><div id="reviews">${(detailData.reviews || []).map((review) => `<p><strong>User</strong> · ${review.rating}/5<br>${escapeHtml(review.review_text)}</p>`).join("") || "No reviews yet."}</div><form id="review-form"><input id="review-rating" type="number" min="1" max="5" value="5" required><textarea id="review-text" placeholder="Share your experience" required></textarea><button>Post review</button></form>`);
      document.querySelector("#favorite").addEventListener("click", async () => { if (!session) return (authMessage.textContent = "Sign in to save favorites."); const r = await api(favorite ? `/api/favorites?amenity_id=${encodeURIComponent(amenity.id)}` : "/api/favorites", { method: favorite ? "DELETE" : "POST", ...(favorite ? { body: undefined } : { body: JSON.stringify({ amenity_id: amenity.id }) }) }); if (r.ok) document.querySelector("#favorite").textContent = favorite ? "Save favorite" : "Remove favorite"; });
      document.querySelector("#review-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!session) return (authMessage.textContent = "Sign in to post reviews."); const r = await api("/api/reviews", { method: "POST", body: JSON.stringify({ amenity_id: amenity.id, rating: Number(document.querySelector("#review-rating").value), review_text: document.querySelector("#review-text").value }) }); if (r.ok) { document.querySelector("#review-text").value = ""; authMessage.textContent = "Review saved."; } else { authMessage.textContent = (await r.json()).error || "Unable to save review."; } });
    });
    if (type?.name === "Bike Rack") marker.addTo(bikeRackMarkers);
    else marker.addTo(markers);
  });
  count.textContent = `${visible.length} amenities shown`;
}

async function load() {
  try {
    const bounds = map.getBounds();
    const params = new URLSearchParams({ limit: "1000", south: String(bounds.getSouth()), north: String(bounds.getNorth()), west: String(bounds.getWest()), east: String(bounds.getEast()) });
    const all = [];
    for (let offset = 0; ; offset += 1000) {
      params.set("offset", String(offset));
      const response = await fetch(`/api/amenities?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load amenities");
      all.push(...(data.amenities || []));
      if ((data.amenities || []).length < 1000) break;
    }
    amenities = all;
    const types = [...new Map(amenities.map((a) => { const t = Array.isArray(a.amenity_types) ? a.amenity_types[0] : a.amenity_types; return [t?.name, t]; }).filter(([name]) => name)).values()];
    if (enabledTypes.size === 0 && !hasSavedTypePreference) types.forEach((type) => enabledTypes.add(type.name));
    types.forEach((type) => { if (!enabledTypes.has(type.name) && !hasSavedTypePreference) enabledTypes.add(type.name); });
    document.querySelector("#type-filters").innerHTML = types.map((type) => `<label class="type-filter"><input type="checkbox" data-type="${escapeHtml(type.name)}" ${enabledTypes.has(type.name) ? "checked" : ""}><span style="color:${escapeHtml(type.color || "#3388ff")}">●</span>${escapeHtml(type.name)}</label>`).join("");
    document.querySelectorAll("[data-type]").forEach((input) => { input.addEventListener("change", () => { hasSavedTypePreference = true; input.checked ? enabledTypes.add(input.dataset.type) : enabledTypes.delete(input.dataset.type); localStorage.setItem("amenity-enabled-types", JSON.stringify([...enabledTypes])); renderMarkers(); }); });
    status.textContent = "OpenStreetMap map connected";
    renderMarkers();
  } catch (error) {
    status.textContent = "Map API unavailable";
    count.textContent = error.message;
  }
}
search.addEventListener("input", renderMarkers);
document.querySelector("#inactive").addEventListener("change", () => { localStorage.setItem("amenity-show-inactive", document.querySelector("#inactive").checked); renderMarkers(); }); document.querySelector("#accessible").addEventListener("change", () => { localStorage.setItem("amenity-accessible-only", document.querySelector("#accessible").checked); renderMarkers(); });
document.querySelector("#locate").addEventListener("click", () => navigator.geolocation?.getCurrentPosition(
  ({ coords }) => map.setView([coords.latitude, coords.longitude], 15),
  () => { status.textContent = "Location permission was unavailable"; }
));
map.on("moveend", () => { clearTimeout(viewportLoadTimer); viewportLoadTimer = setTimeout(load, 180); });
const savedView = JSON.parse(localStorage.getItem("amenity-map-view") || "null");
if (savedView?.center && Number.isFinite(savedView.zoom)) map.setView(savedView.center, savedView.zoom);
map.on("moveend", () => { const center = map.getCenter(); localStorage.setItem("amenity-map-view", JSON.stringify({ center: [center.lat, center.lng], zoom: map.getZoom() })); });
fetch("/api/health").then((response) => response.json()).then((data) => {
  if (!data.supabaseConfigured) status.textContent = "Supabase is not configured";
}).catch(() => { status.textContent = "The API is not reachable"; });
load();

document.querySelector("#login").addEventListener("click", async () => { const email = document.querySelector("#email").value, password = document.querySelector("#password").value; const result = await auth.auth.signInWithPassword({ email, password }); if (result.error) authMessage.textContent = result.error.message; });
document.querySelector("#signup").addEventListener("click", async () => { const email = document.querySelector("#email").value, password = document.querySelector("#password").value; const result = await auth.auth.signUp({ email, password }); if (result.error) authMessage.textContent = result.error.message; else authMessage.textContent = "Check your email to confirm your account."; });
document.querySelector("#logout").addEventListener("click", () => auth.auth.signOut());
updateAuthUi();

async function loadChats() {
  const response = await api("/api/chats");
  if (!response.ok) return;
  const data = await response.json();
  const select = document.querySelector("#chat-select");
  select.innerHTML = (data.chats || []).map((item) => `<option value="${item.chat_id}">${escapeHtml(item.chats?.name || `Chat ${item.chat_id}`)}</option>`).join("");
  document.querySelector("#chat-panel").hidden = false;
  if (select.value) loadMessages(select.value);
  select.onchange = () => loadMessages(select.value);
  if (chatChannel) await auth.removeChannel(chatChannel);
  chatChannel = auth.channel("messages-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
    if (String(payload.new.chat_id) === String(select.value)) appendMessage(payload.new);
  }).subscribe();
}

async function loadMessages(chatId) {
  const response = await api(`/api/chats/messages?chat_id=${encodeURIComponent(chatId)}`);
  if (!response.ok) return;
  const data = await response.json();
  document.querySelector("#chat-messages").innerHTML = "";
  (data.messages || []).forEach(appendMessage);
}

function appendMessage(message) {
  const container = document.querySelector("#chat-messages");
  const item = document.createElement("div"); item.className = "chat-message";
  item.textContent = `${message.profiles?.username || (message.sender_id === session?.user?.id ? "You" : "User")}: ${message.content}`;
  container.appendChild(item); container.scrollTop = container.scrollHeight;
}

document.querySelector("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const chatId = document.querySelector("#chat-select").value; const input = document.querySelector("#chat-text");
  if (!chatId || !input.value.trim()) return;
  const response = await api("/api/chats/messages", { method: "POST", body: JSON.stringify({ chat_id: Number(chatId), content: input.value.trim() }) });
  if (response.ok) input.value = "";
});
document.querySelector("#open-chat").addEventListener("click", () => { if (!session) return (authMessage.textContent = "Sign in to use chat."); document.querySelector("#chat-panel").hidden = false; });
document.querySelector("#food-request").addEventListener("click", async () => { if (!session) return (authMessage.textContent = "Sign in to request food assistance."); const center = map.getCenter(); const response = await api("/api/food-requests", { method: "POST", body: JSON.stringify({ latitude: center.lat, longitude: center.lng }) }); authMessage.textContent = response.ok ? "Food request created at your map location." : ((await response.json()).error || "Unable to create request."); });
