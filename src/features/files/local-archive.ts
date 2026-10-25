import { BaseDirectory, mkdir, readDir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { blueprintZip } from "../diagrams/blueprint-export";

export type ArchiveDocument = { name: string; contents: string };
const ARCHIVE_FOLDER = ".sdbackup";
const ARCHIVE_RETENTION_MS = 30 * 86_400_000;
const ARCHIVE_LIMIT_BYTES = 256 * 1024 * 1024;
const safeName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim().replace(/\.+$/g, "").slice(0, 160) || "document";

export async function createLocalDocumentArchive(documents: ArchiveDocument[], now = Date.now()) {
  if (!documents.length) throw new Error("There are no open documents to archive.");
  await mkdir(ARCHIVE_FOLDER, { baseDir: BaseDirectory.AppLocalData, recursive: true });
  const timestamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  const files = documents.map((document, index) => ({ path: `${index + 1}-${safeName(document.name)}`, contents: document.contents }));
  const archive = blueprintZip(files, ARCHIVE_LIMIT_BYTES);
  const name = `sketchdraw-${now}-${safeName(documents.map(document => document.name.replace(/\.(?:sketch|sdplan)$/i, "")).join("-and-")).slice(0, 100)}.zip`;
  await writeFile(`${ARCHIVE_FOLDER}/${name}`, archive, { baseDir: BaseDirectory.AppLocalData });
  const oldestAllowed = now - ARCHIVE_RETENTION_MS;
  const entries = await readDir(ARCHIVE_FOLDER, { baseDir: BaseDirectory.AppLocalData });
  const expired = entries.filter(entry => entry.isFile && /^sketchdraw-(\d{13})-.+\.zip$/i.test(entry.name) && Number(/^sketchdraw-(\d{13})-/i.exec(entry.name)?.[1]) < oldestAllowed);
  await Promise.all(expired.map(entry => remove(`${ARCHIVE_FOLDER}/${entry.name}`, { baseDir: BaseDirectory.AppLocalData })));
  return { name, removed: expired.length, createdAt: now, timestamp };
}
