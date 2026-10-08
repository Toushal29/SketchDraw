import { For, Show, createSignal } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ProjectFileEntry } from "../../model";

type Props = { files: ProjectFileEntry[]; editable: boolean; onAdd: (file: ProjectFileEntry) => void; onUpdate: (id: string, patch: Partial<ProjectFileEntry>) => void; onDelete: (id: string) => void };
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function fileName(path: string) {
  const decoded = (() => { try { return decodeURIComponent(path); } catch { return path; } })();
  return decoded.split(/[\\/]/).pop()?.slice(0, 500) || "Attached file";
}

function mimeType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  return types[extension ?? ""] ?? "application/octet-stream";
}

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

export function ProjectFiles(props: Props) {
  const [linkName, setLinkName] = createSignal("");
  const [linkUrl, setLinkUrl] = createSignal("");
  const [fileError, setFileError] = createSignal("");
  const attachFiles = async () => {
    if (!props.editable) return;
    setFileError("");
    try {
      const selected = await open({ title: "Add project files", multiple: true });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      let usedBytes = props.files.filter((item): item is Extract<ProjectFileEntry, { kind: "attachment" }> => item.kind === "attachment").reduce((total, item) => total + item.size, 0);
      for (const path of paths) {
        const bytes = await readFile(path);
        if (bytes.length > MAX_FILE_BYTES) throw new Error(`${fileName(path)} is larger than 8 MB.`);
        if (usedBytes + bytes.length > 32 * 1024 * 1024) throw new Error("Project attachments are limited to 32 MB in total.");
        const name = fileName(path);
        const type = mimeType(name);
        props.onAdd({ id: crypto.randomUUID(), kind: "attachment", name, mimeType: type, dataUrl: `data:${type};base64,${encodeBytes(bytes)}`, size: bytes.length, createdAt: Date.now() });
        usedBytes += bytes.length;
      }
    } catch (cause) { setFileError(`Could not attach file: ${String(cause)}`); }
  };
  const addLink = (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.editable) return;
    try {
      const url = new URL(linkUrl().trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use an HTTP or HTTPS link.");
      props.onAdd({ id: crypto.randomUUID(), kind: "link", name: linkName().trim().slice(0, 500) || url.hostname, url: url.toString(), createdAt: Date.now() });
      setLinkName(""); setLinkUrl(""); setFileError("");
    } catch (cause) { setFileError(`Could not add link: ${String(cause)}`); }
  };

  return (
    <div class="project-page project-files-page">
      <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT REFERENCES</span><h1>Project files</h1><p>Keep attachments, reference images, exported documents, and useful links with this sketch.</p></div><Show when={props.editable}><button class="project-primary-action" onClick={() => void attachFiles()}>Attach files</button></Show></div>
      <Show when={props.editable}><form class="project-link-form" onSubmit={addLink}><input value={linkName()} maxlength="500" placeholder="Link name (optional)" aria-label="Link name" onInput={event => setLinkName(event.currentTarget.value)} /><input value={linkUrl()} maxlength="2048" type="url" placeholder="https://example.com" aria-label="Web link" onInput={event => setLinkUrl(event.currentTarget.value)} /><button disabled={!linkUrl().trim()}>Add link</button></form></Show>
      <Show when={fileError()}><p class="project-file-error" role="alert">{fileError()}</p></Show>
      <section class="project-file-grid" aria-label="Project files">
        <Show when={props.files.length} fallback={<div class="project-empty-state"><strong>No project files yet</strong><p>Attach a reference image or exported document, or save a web link here. Attachments are stored inside this .sketch file.</p></div>}>
          <For each={props.files.map(file => file.id)}>{id => {
            const file = () => props.files.find(item => item.id === id)!;
            return <article class={`project-file-card file-kind-${file().kind}`}>
              <Show when={file().kind === "attachment" && (file() as Extract<ProjectFileEntry, { kind: "attachment" }>).mimeType.startsWith("image/")}>
                <img class="project-file-preview" src={(file() as Extract<ProjectFileEntry, { kind: "attachment" }>).dataUrl} alt={`Preview: ${file().name}`} loading="lazy" />
              </Show>
              <div class="project-file-icon" aria-hidden="true">{file().kind === "link" ? "LINK" : (file() as Extract<ProjectFileEntry, { kind: "attachment" }>).mimeType.split("/").pop()?.slice(0, 5).toUpperCase()}</div>
              <Show when={props.editable} fallback={<strong class="project-file-name">{file().name}</strong>}><input class="project-file-name-input" value={file().name} aria-label="File name" onInput={event => props.onUpdate(id, { name: event.currentTarget.value.slice(0, 500) })} /></Show>
              <Show when={file().kind === "attachment"} fallback={<p class="project-file-url">{(file() as Extract<ProjectFileEntry, { kind: "link" }>).url}</p>}>
                <small>{((file() as Extract<ProjectFileEntry, { kind: "attachment" }>).size / 1_048_576).toFixed(2)} MB · Stored in this file</small>
              </Show>
              <div class="project-file-actions">
                <Show when={file().kind === "attachment"} fallback={<a href={(file() as Extract<ProjectFileEntry, { kind: "link" }>).url} target="_blank" rel="noreferrer">Open link</a>}>
                  <a href={(file() as Extract<ProjectFileEntry, { kind: "attachment" }>).dataUrl} download={file().name}>Download</a>
                </Show>
                <Show when={props.editable}><button class="project-row-delete" onClick={() => props.onDelete(id)}>Remove</button></Show>
              </div>
            </article>;
          }}</For>
        </Show>
      </section>
    </div>
  );
}
