import { crc32 } from "../files/crc32";

export const MAX_VSDX_ARCHIVE_BYTES = 25_000_000;
export const MAX_VSDX_EXPANDED_BYTES = 50_000_000;
const MAX_VSDX_ENTRIES = 4096;
export { crc32 } from "../files/crc32";

async function inflateBounded(compressed: Uint8Array, expectedLength: number, name: string): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("This runtime cannot decompress Visio packages.");
  const output = new Uint8Array(expectedLength);
  const stream = new Blob([compressed.slice().buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  const reader = stream.getReader();
  let written = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > expectedLength - written) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`The Visio package entry “${name}” expands beyond its declared size.`);
      }
      output.set(value, written);
      written += value.byteLength;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof Error && error.message.includes("expands beyond its declared size")) throw error;
    throw new Error(`Could not decompress the Visio package entry “${name}”.`);
  }
  if (written !== expectedLength) throw new Error(`The Visio package entry “${name}” failed its integrity check.`);
  return output;
}

/** Validates and expands a bounded VSDX ZIP archive. Call this from a worker. */
export async function validateVsdxArchive(archive: Uint8Array): Promise<Map<string, Uint8Array>> {
  if (archive.byteLength > MAX_VSDX_ARCHIVE_BYTES) throw new Error("Visio packages are limited to 25 MB.");
  if (archive.byteLength < 22) throw new Error("The selected file is not a supported ZIP-based Visio package.");

  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  let endOffset = -1;
  for (let offset = archive.byteLength - 22; offset >= Math.max(0, archive.byteLength - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) { endOffset = offset; break; }
  }
  if (endOffset < 0) throw new Error("The selected file is not a supported ZIP-based Visio package.");

  const diskNumber = view.getUint16(endOffset + 4, true);
  const directoryDisk = view.getUint16(endOffset + 6, true);
  const diskEntries = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  const commentLength = view.getUint16(endOffset + 20, true);
  if (endOffset + 22 + commentLength !== archive.byteLength || diskNumber !== 0 || directoryDisk !== 0 || diskEntries !== entryCount
    || entryCount > MAX_VSDX_ENTRIES || directoryOffset + directorySize > endOffset) {
    throw new Error("The Visio package directory is invalid or too large.");
  }

  const decoder = new TextDecoder();
  const entries = new Map<string, Uint8Array>();
  let cursor = directoryOffset;
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > endOffset || view.getUint32(cursor, true) !== 0x02014b50) throw new Error("The Visio package directory is corrupt.");
    const method = view.getUint16(cursor + 10, true);
    const checksum = view.getUint32(cursor + 16, true);
    const compressedLength = view.getUint32(cursor + 20, true);
    const plainLength = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const entryCommentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const nextCursor = cursor + 46 + nameLength + extraLength + entryCommentLength;
    if (nextCursor > endOffset || nextCursor > directoryOffset + directorySize) throw new Error("The Visio package directory is corrupt.");
    const name = decoder.decode(archive.subarray(cursor + 46, cursor + 46 + nameLength));
    const normalizedName = name.replace(/\\/g, "/");
    cursor = nextCursor;

    if (plainLength > MAX_VSDX_EXPANDED_BYTES - expandedBytes) throw new Error("The expanded Visio package exceeds the 50 MB import limit.");
    expandedBytes += plainLength;
    if (!name || normalizedName.startsWith("/") || normalizedName.split("/").includes("..") || normalizedName.endsWith("/")) continue;
    if (entries.has(normalizedName)) throw new Error("The Visio package contains duplicate file names.");
    if (localOffset + 30 > directoryOffset || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("The Visio package directory is corrupt.");

    const localMethod = view.getUint16(localOffset + 8, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localNameStart = localOffset + 30;
    const dataOffset = localNameStart + localNameLength + localExtraLength;
    if (dataOffset > directoryOffset || dataOffset + compressedLength > directoryOffset || localMethod !== method
      || decoder.decode(archive.subarray(localNameStart, localNameStart + localNameLength)) !== name) {
      throw new Error("A Visio package entry extends beyond the archive or does not match its directory record.");
    }
    const compressed = archive.subarray(dataOffset, dataOffset + compressedLength);
    let plain: Uint8Array;
    if (method === 0) {
      if (compressedLength !== plainLength) throw new Error(`The Visio package entry “${name}” failed its integrity check.`);
      plain = compressed.slice();
    } else if (method === 8) plain = await inflateBounded(compressed, plainLength, name);
    else throw new Error("This Visio package uses an unsupported compression method.");

    if (crc32(plain) !== checksum) throw new Error(`The Visio package entry “${name}” failed its integrity check.`);
    entries.set(normalizedName, plain);
  }
  if (cursor !== directoryOffset + directorySize) throw new Error("The Visio package directory is corrupt.");
  return entries;
}
