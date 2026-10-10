import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
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
let browserError = "";
const pending = new Map();
let requestId = 0;
function send(method, params = {}, sessionId) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 60000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
try {
  const bundle = await build({ configFile: false, root, logLevel: "error", build: { write: false, minify: false, lib: { entry: path.join(root, "tests/canvas-performance.browser.ts"), name: "CanvasAudit", formats: ["iife"] } } });
  const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(item => item.type === "chunk").code;
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
    const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
  };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const result = await send("Runtime.evaluate", { expression: `${baseline}\n${code}\n;globalThis.__canvasAudit`, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  process.stdout.write(`${JSON.stringify(result.result.value, null, 2)}\n`);
  if (result.result.value.failures.length) process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await send("Browser.close").catch(() => {}); socket.close(); }
  browser?.kill();
  for (const request of pending.values()) clearTimeout(request.timer);
  if (path.dirname(profile) !== root || !path.basename(profile).startsWith(".focused-test-build-browser-")) throw new Error("Unexpected browser profile path");
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
