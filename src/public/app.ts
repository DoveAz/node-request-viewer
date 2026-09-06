// The panel is browser JavaScript emitted from this TypeScript source.
// DOM event wiring is intentionally kept dynamic because the panel is served as a static asset.
// @ts-nocheck
const records = [];
const list = document.querySelector("#list");
const detail = document.querySelector("#detail");
const status = document.querySelector("#status");
const count = document.querySelector("#count");
const search = document.querySelector("#search");
const method = document.querySelector("#method");
const viewport = document.querySelector("#list-viewport");
const spacer = document.querySelector("#list-spacer");
const rows = document.querySelector("#list-rows");
const filterBar = document.querySelector("#filter-bar");
const ROW_HEIGHT = 38;
let visibleRecords = [];
let activeFilter = "all";
let selectedId = null;
let activeTopTab = "overview";
let activeBottomTab = "response-body";

function renderList() {
  const query = search.value.trim().toLowerCase();
  const selectedMethod = method.value;
  visibleRecords = records.filter((record) => (!selectedMethod || record.method === selectedMethod) && (!query || `${record.method} ${record.url} ${record.status}`.toLowerCase().includes(query)) && matchesFilter(record, activeFilter));
  count.textContent = `${visibleRecords.length} / ${records.length} requests`;
  spacer.style.height = `${visibleRecords.length * ROW_HEIGHT}px`;
  renderVisibleRows();
}

function renderVisibleRows() {
  const first = Math.max(0, Math.floor(viewport.scrollTop / ROW_HEIGHT) - 8);
  const last = Math.min(visibleRecords.length, Math.ceil((viewport.scrollTop + viewport.clientHeight) / ROW_HEIGHT) + 8);
  rows.style.transform = `translateY(${first * ROW_HEIGHT}px)`;
  rows.replaceChildren(...visibleRecords.slice(first, last).map((record) => {
    const row = document.createElement("div");
    row.className = `row${record.id === selectedId ? " selected" : ""}`;
    const rowNumber = records.indexOf(record) + 1;
    row.innerHTML = `<span class="row-id">${rowNumber}</span><span class="request-icon">${requestIcon(record)}</span><span class="method ${escapeHtml(record.method.toLowerCase())}">${escapeHtml(record.method)}</span><span class="url" title="${escapeHtml(record.url)}">${escapeHtml(record.url)}</span><span class="content-type" title="${escapeHtml(record.responseContentType || "Pending")}">${escapeHtml(record.responseContentType || "Pending")}</span><span class="status ${statusClass(record)}">${escapeHtml(record.status ?? "Pending")}</span><span class="duration">${escapeHtml(record.durationMs ?? "-")}ms</span>`;
    row.onclick = () => { selectedId = record.id; activeTopTab = "overview"; activeBottomTab = "response-body"; renderList(); renderDetail(record); };
    return row;
  }));
}

function requestIcon(record) {
  if (record.url.startsWith("ws://") || record.url.startsWith("wss://")) return "◌";
  const type = record.responseBody?.type;
  return { json: "{}", html: "◇", xml: "<>", javascript: "JS", image: "◉", binary: "▧" }[type] || "◌";
}

function matchesFilter(record, filter) {
  if (filter === "all") return true;
  if (filter === "http") return record.url.startsWith("http://");
  if (filter === "https") return record.url.startsWith("https://");
  if (filter === "websocket") return record.url.startsWith("ws://") || record.url.startsWith("wss://");
  if (/^[1-5]xx$/.test(filter)) return record.status != null && Math.floor(record.status / 100) === Number(filter[0]);
  return record.responseBody?.type === filter || (filter === "image" && record.responseContentType?.startsWith("image/")) || (filter === "binary" && record.responseBody?.encoding === "base64");
}

function renderDetail(record) {
  if (!record) { detail.innerHTML = '<div id="empty">Select a request to inspect its details</div>'; return; }
  const topTabs = ["overview", "raw", "query", "request-headers", "request-body", "cookies"];
  const bottomTabs = ["response-raw", "response-headers", "response-body"];
  const labels = { overview: "Overview", raw: "Raw", query: "Query", "request-headers": "Request Headers", "request-body": "Request Body", cookies: "Cookies", "response-raw": "Raw", "response-headers": "Response Headers", "response-body": "Response Body" };
  const topContent = {
    overview: `<p class="section-title">General</p><div class="kv"><label>Status</label><span>${escapeHtml(record.status ?? "Pending")} ${escapeHtml(record.statusText ?? "")}</span></div><div class="kv"><label>Method</label><span>${escapeHtml(record.method)}</span></div><div class="kv"><label>Protocol</label><span>${escapeHtml(new URL(record.url).protocol.replace(":", ""))}</span></div><div class="kv"><label>Content Type</label><span>${escapeHtml(record.responseContentType || "Pending")}</span></div><div class="kv"><label>Started</label><span>${escapeHtml(formatBeijingTime(record.timestamp))}</span></div><div class="kv"><label>Duration</label><span>${escapeHtml(record.durationMs ?? "-")} ms</span></div>`,
    raw: `<p class="section-title">Request</p><pre>${renderRaw(record)}</pre>`,
    query: renderQuery(record.url),
    "request-headers": renderHeaders(record.requestHeaders),
    "request-body": renderBody(record.requestBody),
    cookies: renderCookies(record),
  }[activeTopTab];
  const bottomContent = {
    "response-raw": `<p class="section-title">Response</p><pre>${renderResponseRaw(record)}</pre>`,
    "response-headers": renderHeaders(record.responseHeaders),
    "response-body": `${renderBody(record.responseBody)}${record.error ? `<p class="section-title">Error</p>${renderHeaders(record.error)}` : ""}`,
  }[activeBottomTab];
  detail.innerHTML = `<section class="detail-pane detail-top"><div class="detail-head"><button class="detail-actions" id="copy-curl">Copy cURL</button><h2>${escapeHtml(record.method)} ${escapeHtml(record.url)}</h2><p>${escapeHtml(formatBeijingTime(record.timestamp))} · ${escapeHtml(record.durationMs ?? "-")} ms</p></div><nav class="tabs">${topTabs.map((tab) => `<button class="tab ${tab === activeTopTab ? "active" : ""}" data-top-tab="${tab}">${labels[tab]}</button>`).join("")}</nav><section class="tab-panel">${topContent}</section></section><section class="detail-pane detail-bottom"><nav class="tabs">${bottomTabs.map((tab) => `<button class="tab ${tab === activeBottomTab ? "active" : ""}" data-bottom-tab="${tab}">${labels[tab]}</button>`).join("")}</nav><section class="tab-panel">${bottomContent}</section></section>`;
  detail.querySelector("#copy-curl").onclick = async (event) => {
    const button = event.currentTarget;
    await navigator.clipboard.writeText(toCurl(record));
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = "Copy cURL"; }, 1200);
  };
  detail.querySelectorAll("[data-top-tab]").forEach((button) => { button.onclick = () => { activeTopTab = button.dataset.topTab; renderDetail(record); }; });
  detail.querySelectorAll("[data-bottom-tab]").forEach((button) => { button.onclick = () => { activeBottomTab = button.dataset.bottomTab; renderDetail(record); }; });
}

function statusClass(record) {
  if (record.state === "pending") return "pending";
  if (record.error) return "error";
  if (record.status == null) return "pending";
  return `s${Math.floor(record.status / 100)}`;
}

function renderBody(body) {
  if (!body) return '<pre>(empty)</pre>';
  const meta = `<div class="body-meta"><span class="badge">${escapeHtml(body.type || "text")}</span><span>${escapeHtml(body.mimeType || "")}</span><span>${escapeHtml(body.size ?? 0)} bytes</span></div>`;
  if (body.encoding === "base64" && body.mimeType?.startsWith("image/")) {
    const source = `data:${body.mimeType};base64,${body.value}`;
    return `${meta}<img class="response-image" src="${escapeHtml(source)}" alt="Response image" />`;
  }
  if (body.encoding === "base64" || body.type === "binary") return `${meta}<pre>${escapeHtml(body.value)}</pre>`;
  const language = { json: "json", html: "xml", xml: "xml", javascript: "javascript", css: "css", graphql: "graphql", text: "plaintext", form: "plaintext" }[body.type] || "plaintext";
  let source = body.value;
  if (body.type === "json") {
    try {
      source = JSON.stringify(JSON.parse(body.value), null, 2);
    } catch {
      source = body.value;
    }
  }
  const highlighted = language === "plaintext" ? escapeHtml(source) : window.hljs.highlight(source, { language }).value;
  return `${meta}<pre class="hljs">${highlighted}</pre>`;
}

function renderHeaders(headers) {
  if (!headers) return '<pre>(empty)</pre>';
  const source = JSON.stringify(headers, null, 2);
  return `<pre class="hljs">${window.hljs.highlight(source, { language: "json" }).value}</pre>`;
}

function renderRaw(record) {
  const requestLine = `${record.method} ${record.url} HTTP/1.1`;
  const headers = Object.entries(record.requestHeaders || {}).map(([name, value]) => `${name}: ${value}`).join("\n");
  return escapeHtml(`${requestLine}\n${headers}\n\n${record.requestBody?.value || ""}`);
}

function renderResponseRaw(record) {
  const statusLine = `HTTP/1.1 ${record.status ?? "Pending"} ${record.statusText ?? ""}`;
  const headers = Object.entries(record.responseHeaders || {}).map(([name, value]) => `${name}: ${value}`).join("\n");
  return escapeHtml(`${statusLine}\n${headers}\n\n${record.responseBody?.encoding === "utf8" ? record.responseBody.value : ""}`);
}

function renderQuery(url) {
  const params = Object.fromEntries(new URL(url).searchParams.entries());
  return `<p class="section-title">Query parameters</p>${renderHeaders(params)}`;
}

function renderCookies(record) {
  const requestCookies = record.requestHeaders?.cookie || record.requestHeaders?.Cookie || "";
  const responseCookies = record.responseHeaders?.["set-cookie"] || "";
  return `<p class="section-title">Request Cookies</p><pre>${escapeHtml(requestCookies || "(empty)")}</pre><p class="section-title">Response Set-Cookie</p><pre>${escapeHtml(responseCookies || "(empty)")}</pre>`;
}

function formatBeijingTime(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function toCurl(record) {
  const parts = ["curl", "-X", shellQuote(record.method), shellQuote(record.url)];
  for (const [name, value] of Object.entries(record.requestHeaders || {})) {
    parts.push("-H", shellQuote(`${name}: ${value}`));
  }
  if (record.requestBody?.encoding === "utf8" && record.requestBody.value) {
    parts.push("--data-raw", shellQuote(record.requestBody.value));
  }
  return parts.join(" ");
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function addRecord(message) {
  const record = message.record ?? message;
  const index = records.findIndex((item) => item.id === record.id);
  if (index === -1) records.push(record); else records[index] = record;
  renderList();
  if (selectedId === null || selectedId === record.id) { selectedId = record.id; renderDetail(record); }
}

fetch("/api/requests").then((response) => response.json()).then((saved) => { saved.forEach((record) => addRecord(record)); });
const socket = new WebSocket(`ws://${location.host}`);
socket.onopen = () => { status.textContent = "已连接"; };
socket.onclose = () => { status.textContent = "已断开"; };
socket.onmessage = (event) => addRecord(JSON.parse(event.data));
document.querySelector("#clear").onclick = () => { records.length = 0; renderList(); detail.innerHTML = '<p class="muted">选择一个请求查看详情</p>'; };
document.querySelector("#export").onclick = () => { const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "network-requests.json"; link.click(); URL.revokeObjectURL(link.href); };
viewport.onscroll = renderVisibleRows;
search.oninput = () => { viewport.scrollTop = 0; renderList(); };
method.onchange = renderList;
filterBar.querySelectorAll("[data-filter]").forEach((button) => {
  button.onclick = () => {
    activeFilter = button.dataset.filter;
    filterBar.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    viewport.scrollTop = 0;
    renderList();
  };
});
