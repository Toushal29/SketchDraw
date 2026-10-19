import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import solid from "vite-plugin-solid";
import ts from "typescript";

// Runs real Canvas2D pixel checks and repeatable workloads in a local browser.
// Optional BASELINE_STROKE_RENDERER points to a saved pre-change TypeScript file.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [process.env.CANVAS_TEST_BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].filter(Boolean);
let executable;
for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
if (!executable) throw new Error("Set CANVAS_TEST_BROWSER to a Chromium browser executable.");
const profile = await mkdtemp(path.join(root, ".focused-test-build-browser-"));
let browser;
let socket;
let auditServer;
let auditUrl;
let browserError = "";
const pending = new Map();
let requestId = 0;
function send(method, params = {}, sessionId) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 300000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
try {
  const bundle = await build({ configFile: false, root, plugins: [solid()], logLevel: "error", build: { write: false, minify: false, lib: { entry: path.join(root, "scripts/canvas-performance.browser.ts"), name: "CanvasAudit", formats: ["iife"] } } });
  const outputFiles = (Array.isArray(bundle) ? bundle[0] : bundle).output;
  const code = outputFiles.find(item => item.type === "chunk").code;
  const assets = outputFiles.filter(item => item.type === "asset");
  auditServer = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/+/, "");
    const asset = assets.find(item => item.fileName === pathname || pathname.endsWith(item.fileName));
    if (pathname.toLowerCase().includes("elk")) process.stdout.write(`[audit] requested worker asset: ${pathname} (${asset ? "served" : "missing"})\n`);
    if (asset?.type === "asset") {
      const contentType = asset.fileName.endsWith(".js") ? "text/javascript; charset=utf-8" : "application/octet-stream";
      response.writeHead(200, { "content-type": contentType }); response.end(asset.source); return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }); response.end("<!doctype html><html><head></head><body></body></html>");
  });
  await new Promise((resolve, reject) => { auditServer.once("error", reject); auditServer.listen(0, "127.0.0.1", resolve); });
  const address = auditServer.address();
  if (!address || typeof address === "string") throw new Error("Could not determine the local audit server address.");
  auditUrl = `http://127.0.0.1:${address.port}/`;
  let baseline = "";
  if (process.env.BASELINE_STROKE_RENDERER) {
    const source = await readFile(process.env.BASELINE_STROKE_RENDERER, "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^export /gm, "");
    baseline = `globalThis.__baselineRenderer = (() => { ${js}; return createFreehandRenderer; })();`;
  }
  browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  browser.on("error", error => { browserError = error.message; });
  browser.stderr.on("data", data => { browserError = (browserError + data).slice(-2000); });
  let portInfo;
  for (let attempt = 0; attempt < 200; attempt++) {
    try { portInfo = await readFile(path.join(profile, "DevToolsActivePort"), "utf8"); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  if (!portInfo) throw new Error(`Browser did not start: ${browserError}`);
  const [port, endpoint] = portInfo.trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.consoleAPICalled") {
      const values = message.params.args?.map(argument => argument.value ?? argument.description ?? "").filter(Boolean);
      if (values?.length) process.stdout.write(`[browser] ${values.join(" ")}\n`);
      return;
    }
    const request = pending.get(message.id); if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
  };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Page.navigate", { url: auditUrl }, sessionId);
  let secureOriginReady = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const context = await send("Runtime.evaluate", { expression: "({ origin: location.origin, randomUUID: typeof crypto.randomUUID })", returnByValue: true }, sessionId);
    if (context.result.value.origin === new URL(auditUrl).origin && context.result.value.randomUUID === "function") { secureOriginReady = true; break; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!secureOriginReady) throw new Error("The local browser audit page did not initialize in a secure loopback context.");
  const workerDiagnostics = `(() => { const NativeWorker = globalThis.Worker; globalThis.Worker = class extends NativeWorker { constructor(url, options) { const original = String(url); let resolved = url; if (original.startsWith("data:text/javascript;base64,")) { const encoded = original.slice(original.indexOf(",") + 1); const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0)); resolved = URL.createObjectURL(new Blob([bytes], { type: "text/javascript" })); console.info("audit worker: loaded inlined ELK worker through a same-origin blob URL"); } super(resolved, options); this.addEventListener("error", event => console.info("audit worker error:", event.message || "script failed")); } }; })();`;
  const result = await send("Runtime.evaluate", { expression: `${baseline}\n${workerDiagnostics}\n${code}\n;globalThis.__canvasAudit`, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  process.stdout.write(`${JSON.stringify(result.result.value, null, 2)}\n`);
  if (result.result.value.failures.length || result.result.value.importFailures?.length) process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await send("Browser.close").catch(() => {}); socket.close(); }
  browser?.kill();
  if (auditServer?.listening) await new Promise(resolve => auditServer.close(resolve));
  for (const request of pending.values()) clearTimeout(request.timer);
  if (path.dirname(profile) !== root || !path.basename(profile).startsWith(".focused-test-build-browser-")) throw new Error("Unexpected browser profile path");
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
