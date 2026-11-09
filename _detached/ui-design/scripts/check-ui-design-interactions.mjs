import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import solid from "vite-plugin-solid";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [process.env.UI_DESIGN_TEST_BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].filter(Boolean);
let executable;
for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
if (!executable) throw new Error("Set UI_DESIGN_TEST_BROWSER to a Chromium browser executable.");

const profile = await mkdtemp(path.join(root, ".ui-design-interaction-browser-"));
let browser, socket, server;
const pending = new Map();
let requestId = 0;
function send(method, params = {}, sessionId) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression, sessionId) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function click(sessionId, point) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y }, sessionId);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1 }, sessionId);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1 }, sessionId);
  await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))", sessionId);
}
async function drag(sessionId, start, end) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: start.x, y: start.y }, sessionId);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: start.x, y: start.y, button: "left", buttons: 1, clickCount: 1 }, sessionId);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: end.x, y: end.y, button: "left", buttons: 1, steps: 8 }, sessionId);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: end.x, y: end.y, button: "left", buttons: 0, clickCount: 1 }, sessionId);
  await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))", sessionId);
}
async function elementRect(sessionId, selector) {
  const rect = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return null; const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })()`, sessionId);
  assert.ok(rect, `Expected element ${selector} to be rendered`);
  return rect;
}
const center = rect => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const failures = [];
const check = async (name, action) => {
  try { await action(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failures.push({ name, error: String(error) }); process.stderr.write(`FAIL ${name}: ${String(error)}\n`); }
};

try {
  const bundle = await build({ configFile: false, root, plugins: [solid()], define: { "process.env.NODE_ENV": JSON.stringify("production") }, logLevel: "error", build: { write: false, minify: false, lib: { entry: path.join(root, "scripts/ui-design-interactions.browser.tsx"), name: "UIDesignAudit", formats: ["iife"] } } });
  const outputFiles = (Array.isArray(bundle) ? bundle[0] : bundle).output;
  const code = outputFiles.find(item => item.type === "chunk")?.code;
  const styles = outputFiles.filter(item => item.type === "asset" && item.fileName.endsWith(".css")).map(item => String(item.source)).join("\n");
  assert.ok(code, "The browser interaction fixture should bundle.");
  assert.ok(styles, "The UI Design stylesheet should be included in the browser fixture.");

  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html><head><meta charset="utf-8"><style>html,body,#ui-design-audit-root{margin:0;width:100%;height:100%;overflow:hidden}body{font:14px system-ui}</style><style>${styles}</style></head><body><div id="mount"></div><script>${code}</script></body></html>`);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine the interaction server address.");
  const url = `http://127.0.0.1:${address.port}/`;
  browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let browserError = "";
  browser.stderr.on("data", data => { browserError = (browserError + data).slice(-2000); });
  let portInfo;
  for (let attempt = 0; attempt < 200; attempt++) { try { portInfo = await readFile(path.join(profile, "DevToolsActivePort"), "utf8"); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  if (!portInfo) throw new Error(`Chromium did not start: ${browserError}`);
  const [port, endpoint] = portInfo.trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer); pending.delete(message.id);
    if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result);
  };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.navigate", { url }, sessionId);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate("!!globalThis.__uiDesignAudit", sessionId)) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(await evaluate("!!globalThis.__uiDesignAudit", sessionId), "UI Design browser fixture should mount.");
  await click(sessionId, center(await elementRect(sessionId, ".ui-topbar-view-actions button[title='Fit all']")));
  const ids = await evaluate("globalThis.__uiDesignAudit.ids", sessionId);
  const node = id => `.ui-node[data-node-id="${id}"]`;

  await check("hit testing selects a child inside rotated nested containers", async () => {
    await click(sessionId, center(await elementRect(sessionId, node(ids.hitTarget))));
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(node(ids.hitTarget))})?.classList.contains('is-selected')`, sessionId), true);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(node(ids.transformed))})?.classList.contains('is-selected')`, sessionId), false);
  });

  await check("marquee selection collects multiple children within a frame", async () => {
    const points = await evaluate(`(() => { const api = globalThis.__uiDesignAudit; const stage = document.querySelector('.ui-canvas-stage'); const plane = document.querySelector('.ui-infinite-plane'); const matrix = new DOMMatrix(getComputedStyle(plane).transform); const rect = stage.getBoundingClientRect(); const t = api.worldTransform(${JSON.stringify(ids.screen)}); const point = (x, y) => { const a = t.rotation * Math.PI / 180; const wx = t.x + x * Math.cos(a) - y * Math.sin(a); const wy = t.y + x * Math.sin(a) + y * Math.cos(a); return { x: rect.left + matrix.a * wx + matrix.c * wy + matrix.e, y: rect.top + matrix.b * wx + matrix.d * wy + matrix.f }; }; return { start: point(18, 18), end: point(485, 110) }; })()`, sessionId);
    await drag(sessionId, points.start, points.end);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(node(ids.marqueeA))})?.classList.contains('is-selected')`, sessionId), true);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(node(ids.marqueeB))})?.classList.contains('is-selected')`, sessionId), true);
  });

  await check("layer drag reparents without changing world position or rotation", async () => {
    await click(sessionId, center(await elementRect(sessionId, ".ui-panel-tabs button:nth-child(2)")));
    const before = await evaluate(`globalThis.__uiDesignAudit.worldTransform(${JSON.stringify(ids.reparentTarget)})`, sessionId);
    const result = await evaluate(`(() => { const rows = [...document.querySelectorAll('.ui-layer-row')]; const find = name => rows.find(row => row.querySelector('.ui-layer-name')?.textContent === name); const source = find('Reparent target'); const target = find('Rotated container'); if (!source || !target) return { source: !!source, target: !!target }; const transfer = new DataTransfer(); const start = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }); source.dispatchEvent(start); const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: target.getBoundingClientRect().right - 8, clientY: target.getBoundingClientRect().top + 10 }); Object.defineProperty(drop, 'offsetX', { value: target.clientWidth - 8 }); target.dispatchEvent(drop); return { source: true, target: true, parentId: globalThis.__uiDesignAudit.document().pages[0].elements.find(node => node.id === ${JSON.stringify(ids.reparentTarget)}).parentId }; })()`, sessionId);
    assert.ok(result.source && result.target, "Source and destination layer rows should be visible.");
    assert.equal(result.parentId, ids.transformed);
    const after = await evaluate(`globalThis.__uiDesignAudit.worldTransform(${JSON.stringify(ids.reparentTarget)})`, sessionId);
    assert.ok(Math.abs(after.x - before.x) < 1e-6 && Math.abs(after.y - before.y) < 1e-6 && after.rotation === before.rotation);
  });

  await check("resizing a nested object updates its geometry in parent-local space", async () => {
    await click(sessionId, center(await elementRect(sessionId, node(ids.nestedResize))));
    const before = await evaluate(`globalThis.__uiDesignAudit.document().pages[0].elements.find(node => node.id === ${JSON.stringify(ids.nestedResize)})`, sessionId);
    const handle = await elementRect(sessionId, `${node(ids.nestedResize)} .handle-se`);
    const hit = await evaluate(`document.elementFromPoint(${handle.x + handle.width / 2}, ${handle.y + handle.height / 2})?.className ?? ""`, sessionId);
    await evaluate("globalThis.__uiResizeEvents = []; for (const type of ['pointerdown','pointermove','pointerup']) document.addEventListener(type, event => globalThis.__uiResizeEvents.push({ type, target: event.target.className?.baseVal ?? event.target.className }), true)", sessionId);
    await drag(sessionId, center(handle), { x: center(handle).x + 24, y: center(handle).y + 24 });
    const after = await evaluate(`globalThis.__uiDesignAudit.document().pages[0].elements.find(node => node.id === ${JSON.stringify(ids.nestedResize)})`, sessionId);
    const events = await evaluate("globalThis.__uiResizeEvents", sessionId);
    assert.match(hit, /ui-resize-handle/, "The resize handle must receive pointer input instead of a parent frame surface.");
    assert.ok(events.some(event => event.type === "pointerdown" && String(event.target).includes("ui-resize-handle")), "Pointer down should begin on the resize handle.");
    assert.ok(after.width > before.width && after.height > before.height, `Expected nested size to grow from ${before.width}x${before.height} to a larger size; received ${after.width}x${after.height}.`);
  });

  await check("prototype connections resolve frame targets through transformed ancestors", async () => {
    const tabs = await evaluate("[...document.querySelectorAll('.ui-inspector-tabs button')].map(item => item.textContent.trim())", sessionId);
    assert.ok(tabs.includes("prototype"));
    await click(sessionId, center(await elementRect(sessionId, ".ui-inspector-tabs button:nth-child(2)")));
    await click(sessionId, center(await elementRect(sessionId, `.ui-layer-row:has(.ui-layer-name)`)));
    const sourceRow = await evaluate(`[...document.querySelectorAll('.ui-layer-row')].find(row => row.querySelector('.ui-layer-name')?.textContent === 'Nested hit target')`, sessionId);
    assert.ok(sourceRow, "Transformed source layer should be available.");
    await evaluate(`(() => { const row = [...document.querySelectorAll('.ui-layer-row')].find(item => item.querySelector('.ui-layer-name')?.textContent === 'Nested hit target'); row.querySelector('.ui-layer-main').click(); })()`, sessionId);
    await click(sessionId, center(await elementRect(sessionId, ".ui-prototype-actions button")));
    await click(sessionId, center(await elementRect(sessionId, node(ids.destination))));
    const links = await evaluate(`globalThis.__uiDesignAudit.document().pages[0].elements.find(node => node.id === ${JSON.stringify(ids.hitTarget)}).interactions`, sessionId);
    assert.ok(links.some(link => link.targetNodeId === ids.destination), "Clicking a transformed frame should complete the prototype link.");

    await evaluate(`(() => { const row = [...document.querySelectorAll('.ui-layer-row')].find(item => item.querySelector('.ui-layer-name')?.textContent === 'Nested hit target'); row.querySelector('.ui-layer-main').click(); })()`, sessionId);
    await click(sessionId, center(await elementRect(sessionId, ".ui-prototype-actions button")));
    const path = await evaluate("document.querySelector('.ui-prototype-wires path')?.getAttribute('d') ?? ''", sessionId);
    assert.match(path, /^M\s*-?[\d.]+\s+-?[\d.]+\s+C\s*-?[\d.]+\s+-?[\d.]+,?\s+-?[\d.]+\s+-?[\d.]+,?\s+-?[\d.]+\s+-?[\d.]+$/);
    const endpoint = await evaluate(`(() => { const svg = document.querySelector('.ui-prototype-wires'); const path = svg.querySelector('path')?.getAttribute('d') ?? ''; const values = path.match(/-?[\\d.]+/g)?.map(Number) ?? []; const bounds = globalThis.__uiDesignAudit.worldBounds(${JSON.stringify(ids.destination)}); return { x: values[values.length - 2] + parseFloat(svg.style.left), y: values[values.length - 1] + parseFloat(svg.style.top), expectedX: bounds?.x, expectedY: bounds ? bounds.y + bounds.height / 2 : undefined }; })()`, sessionId);
    assert.ok(Math.abs(endpoint.x - endpoint.expectedX) < 1e-6 && Math.abs(endpoint.y - endpoint.expectedY) < 1e-6, "The connector endpoint should use the destination frame's transformed world bounds.");
  });

  process.stdout.write(`${JSON.stringify({ checks: 5, failures }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await send("Browser.close").catch(() => {}); socket.close(); }
  browser?.kill();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const request of pending.values()) clearTimeout(request.timer);
  if (path.dirname(profile) !== root || !path.basename(profile).startsWith(".ui-design-interaction-browser-")) throw new Error("Unexpected browser profile path");
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
