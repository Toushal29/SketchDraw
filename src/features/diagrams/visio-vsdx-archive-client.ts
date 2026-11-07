import { MAX_VSDX_ARCHIVE_BYTES } from "./visio-vsdx-archive";

type ArchiveResponse = { ok: true; entries: Array<[string, ArrayBuffer]> } | { ok: false; error: string };

/** Runs ZIP parsing, decompression, and CRC validation outside the canvas UI thread. */
export function unzipVsdxArchiveInWorker(archive: Uint8Array): Promise<Map<string, Uint8Array>> {
  if (archive.byteLength > MAX_VSDX_ARCHIVE_BYTES) return Promise.reject(new Error("Visio packages are limited to 25 MB."));
  if (typeof Worker === "undefined") return Promise.reject(new Error("Background validation is unavailable for Visio packages in this runtime."));

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./visio-vsdx-archive.worker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const finish = (error?: Error, entries?: Map<string, Uint8Array>) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (error) reject(error);
      else resolve(entries ?? new Map());
    };

    worker.onmessage = (event: MessageEvent<ArchiveResponse>) => {
      const response = event.data;
      if (!response.ok) { finish(new Error(response.error)); return; }
      finish(undefined, new Map(response.entries.map(([name, buffer]) => [name, new Uint8Array(buffer)])));
    };
    worker.onerror = event => { event.preventDefault(); finish(new Error("The Visio package validation worker failed.")); };
    worker.onmessageerror = () => finish(new Error("The Visio package validation worker returned an unreadable response."));

    const transferable = archive.slice().buffer as ArrayBuffer;
    worker.postMessage({ archive: transferable }, [transferable]);
  });
}
