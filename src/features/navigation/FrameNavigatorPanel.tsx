import { For, Show } from "solid-js";
import type { CanvasBookmark } from "../../model";
import "./frame-navigator.css";

export type NavigatorPage = { id: string; name: string; active: boolean; frames: { id: string; name: string }[]; bookmarks: CanvasBookmark[] };
export type FrameNavigatorPanelProps = {
  pages: NavigatorPage[];
  selectedFrameId?: string;
  canEdit: boolean;
  onSelectPage: (pageId: string) => void;
  onSelectFrame: (pageId: string, frameId: string) => void;
  onAddBookmark: () => void;
  onJumpBookmark: (pageId: string, bookmarkId: string) => void;
  onRenameBookmark: (pageId: string, bookmarkId: string, name: string) => void;
  onDeleteBookmark: (pageId: string, bookmarkId: string) => void;
  onClose: () => void;
};

/** Figma-style outline of pages, their frames, and saved views. Arrow keys move between rows. */
export function FrameNavigatorPanel(props: FrameNavigatorPanelProps) {
  let root: HTMLElement | undefined;
  const move = (event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement) return;
    const rows = [...(root?.querySelectorAll<HTMLButtonElement>("button.frame-nav-row") ?? [])];
    const at = rows.indexOf(target as HTMLButtonElement);
    if (at < 0) return;
    const next = rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))];
    event.preventDefault(); next?.focus();
  };
  return <aside class="frame-navigator" ref={root} role="dialog" aria-label="Frame navigator" onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); props.onClose(); } else move(event); }}>
    <header><strong>Frames and views</strong><button type="button" class="help-close" aria-label="Close frame navigator" onClick={props.onClose}>&times;</button></header>
    <p class="frame-nav-hint">Alt+Page Down and Page Up jump between frames. Alt+Shift+1 to 9 open saved views.</p>
    <div class="frame-nav-actions"><button type="button" disabled={!props.canEdit} onClick={props.onAddBookmark}>+ Save this view</button></div>
    <ul class="frame-nav-pages"><For each={props.pages}>{page => <li>
      <button type="button" class="frame-nav-row frame-nav-page" classList={{ active: page.active }} aria-current={page.active ? "page" : undefined} onClick={() => props.onSelectPage(page.id)}>{page.name}</button>
      <Show when={page.frames.length}><ul class="frame-nav-frames" aria-label={`Frames on ${page.name}`}><For each={page.frames}>{frame => <li><button type="button" class="frame-nav-row" classList={{ active: props.selectedFrameId === frame.id }} aria-current={props.selectedFrameId === frame.id ? "true" : undefined} onClick={() => props.onSelectFrame(page.id, frame.id)}>{frame.name}</button></li>}</For></ul></Show>
      <Show when={page.bookmarks.length}><ul class="frame-nav-bookmarks" aria-label={`Saved views on ${page.name}`}><For each={page.bookmarks}>{bookmark => <li>
        <button type="button" class="frame-nav-row" aria-label={`Go to view ${bookmark.name}`} onClick={() => props.onJumpBookmark(page.id, bookmark.id)}>&#9733;</button>
        <input aria-label="Saved view name" maxlength="60" value={bookmark.name} disabled={!props.canEdit} onChange={event => props.onRenameBookmark(page.id, bookmark.id, event.currentTarget.value)} />
        <button type="button" class="frame-nav-delete" aria-label={`Delete view ${bookmark.name}`} disabled={!props.canEdit} onClick={() => props.onDeleteBookmark(page.id, bookmark.id)}>&times;</button>
      </li>}</For></ul></Show>
    </li>}</For></ul>
  </aside>;
}
