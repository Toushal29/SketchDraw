import { validateVsdxArchive } from "./visio-vsdx-archive";

type ArchiveRequest = { archive: ArrayBuffer };
type ArchiveResponse = { ok: true; entries: Array<[string, ArrayBuffer]> } | { ok: false; error: string };
type WorkerScope = {
  onmessage: ((event: MessageEvent<ArchiveRequest>) => void) | null;
  postMessage(message: ArchiveResponse, transfer?: Transferable[]): void;
};

const workerScope = globalThis as unknown as WorkerScope;
workerScope.onmessage = async event => {
  try {
    const files = await validateVsdxArchive(new Uint8Array(event.data.archive));
    const entries = [...files].map(([name, bytes]): [string, ArrayBuffer] => {
      const buffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer as ArrayBuffer
        : bytes.slice().buffer as ArrayBuffer;
      return [name, buffer];
    });
    workerScope.postMessage({ ok: true, entries }, entries.map(([, buffer]) => buffer));
  } catch (error) {
    workerScope.postMessage({ ok: false, error: error instanceof Error ? error.message : "The Visio package could not be validated." });
  }
};
