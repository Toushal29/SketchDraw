import type { CanvasDataBinding, CanvasDataSource } from "../../model";

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function normalizeCanvasDataSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || !host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || /^\d+(?:\.\d+){3}$/.test(host) || host.startsWith("[")) return undefined;
    url.hash = "";
    return url.toString();
  } catch { return undefined; }
}

export async function fetchCanvasJsonDataSource(value: string, existingId: string = crypto.randomUUID()) {
  const sourceUrl = normalizeCanvasDataSourceUrl(value);
  if (!sourceUrl) throw new Error("Use a public HTTPS JSON endpoint without embedded credentials.");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(sourceUrl, { method: "GET", credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", headers: { Accept: "application/json" }, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted) throw new Error("The JSON API request timed out after 10 seconds.");
    throw new Error(`Could not reach the JSON API. Check the endpoint and its CORS policy. ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  try {
  if (!response.ok) throw new Error(`The JSON API returned HTTP ${response.status}.`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("json")) throw new Error("The API response must use a JSON content type.");
  const maxBytes = 5_000_000;
  let raw: string;
  if (response.body) {
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let byteLength = 0;
    try {
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        byteLength += chunk.byteLength;
        if (byteLength > maxBytes) { await reader.cancel(); throw new Error("The JSON API response exceeds the 5 MB limit."); }
        chunks.push(chunk);
      }
    } finally { reader.releaseLock(); }
    const combined = new Uint8Array(byteLength); let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
    raw = new TextDecoder().decode(combined);
  } else {
    raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error("The JSON API response exceeds the 5 MB limit.");
  }
  let json: unknown;
  try { json = JSON.parse(raw); } catch { throw new Error("The API response is not valid JSON."); }
  const records = Array.isArray(json) ? json : isRecord(json) ? [json.records, json.data, json.results].find(Array.isArray) as unknown[] | undefined : undefined;
  if (!records?.length || records.length > 10_000 || !records.every(isRecord)) throw new Error("The API must return a non-empty array of up to 10,000 flat records, or an object with a records, data, or results array.");
  const headers = [...new Set(records.flatMap(record => Object.entries(record).flatMap(([key, item]) => key.trim().length > 0 && key.length <= 200 && (item === null || ["string", "number", "boolean"].includes(typeof item)) ? [key] : [])))].slice(0, 100);
  if (headers.length < 2) throw new Error("Each API record needs at least two simple fields so one can identify the record and another can be displayed.");
  const rows = records.map(record => headers.map(header => {
    const value = record[header];
    return value === null || value === undefined ? "" : String(value).slice(0, 50_000);
  }));
  const name = `JSON API · ${new URL(sourceUrl).host}`.slice(0, 200);
  const characterCount = name.length + headers.reduce((sum, header) => sum + header.length, 0) + rows.reduce((sum, row) => sum + row.reduce((rowSum, cell) => rowSum + cell.length, 0), 0);
  if (characterCount > 5_000_000) throw new Error("The API records exceed the 5 MB data limit.");
  return { id: existingId, name, headers, rows, updatedAt: Date.now(), sourceUrl };
  } catch (cause) {
    if (controller.signal.aborted) throw new Error("The JSON API request timed out after 10 seconds.");
    throw cause;
  } finally { window.clearTimeout(timeout); }
}

export function normalizeCanvasDataBinding(value: unknown): CanvasDataBinding | undefined {
  if (!isRecord(value) || typeof value.sourceId !== "string" || !/^[\w.-]{1,100}$/.test(value.sourceId)
    || !Number.isInteger(value.keyColumn) || Number(value.keyColumn) < 0 || Number(value.keyColumn) > 99
    || typeof value.keyValue !== "string" || value.keyValue.length > 50_000
    || !Number.isInteger(value.valueColumn) || Number(value.valueColumn) < 0 || Number(value.valueColumn) > 99) return undefined;
  return { sourceId: value.sourceId, keyColumn: Number(value.keyColumn), keyValue: value.keyValue, valueColumn: Number(value.valueColumn) };
}

export function normalizeCanvasDataSources(value: unknown): CanvasDataSource[] | undefined {
  if (!Array.isArray(value) || value.length > 24) return undefined;
  const ids = new Set<string>(); let totalCharacters = 0;
  const sources: CanvasDataSource[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || !/^[\w.-]{1,100}$/.test(item.id) || ids.has(item.id)
      || typeof item.name !== "string" || !item.name.trim() || item.name.length > 200
      || !Array.isArray(item.headers) || !item.headers.length || item.headers.length > 100
      || item.headers.some(header => typeof header !== "string" || !header.trim() || header.length > 200)
      || !Array.isArray(item.rows) || !item.rows.length || item.rows.length > 10_000
      || !item.rows.every(row => Array.isArray(row) && row.length === (item.headers as unknown[]).length && row.every(cell => typeof cell === "string" && cell.length <= 50_000))
      || !finite(item.updatedAt) || item.updatedAt < 0
      || (item.sourceUrl !== undefined && !normalizeCanvasDataSourceUrl(item.sourceUrl))) return undefined;
    const headers = item.headers as string[]; const rows = item.rows as string[][];
    const sourceCharacters = item.name.length + headers.reduce((sum, header) => sum + header.length, 0) + rows.reduce((sum, row) => sum + row.reduce((rowSum, cell) => rowSum + cell.length, 0), 0);
    if (sourceCharacters > 5_000_000) return undefined;
    totalCharacters += sourceCharacters;
    if (totalCharacters > 10_000_000) return undefined;
    ids.add(item.id);
    const sourceUrl = item.sourceUrl === undefined ? undefined : normalizeCanvasDataSourceUrl(item.sourceUrl);
    sources.push({ id: item.id, name: item.name.trim(), headers: [...headers], rows: rows.map(row => [...row]), updatedAt: item.updatedAt, ...(sourceUrl ? { sourceUrl } : {}) });
  }
  return sources;
}

export function resolveCanvasDataBinding(sources: CanvasDataSource[], binding: CanvasDataBinding) {
  const source = sources.find(item => item.id === binding.sourceId);
  if (!source || binding.keyColumn >= source.headers.length || binding.valueColumn >= source.headers.length) return undefined;
  const row = source.rows.find(item => item[binding.keyColumn] === binding.keyValue);
  return row?.[binding.valueColumn];
}
