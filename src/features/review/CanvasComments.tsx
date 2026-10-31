import { For, Show, createMemo, createSignal } from "solid-js";
import type { Element, Point, ReviewCommentThread } from "../../model";
import { elementBounds } from "../canvas/bounds";
import { flatten } from "../../operations";

type Props = {
  threads: ReviewCommentThread[];
  elements: Element[];
  zoom: number;
  panX: number;
  panY: number;
  editable: boolean;
  activeThreadId?: string;
  selectedElementId?: string;
  canvasAnchor: Point;
  onCreate: (text: string, elementId: string | undefined, anchor: Point) => void;
  onReply: (threadId: string, text: string) => void;
  onResolve: (threadId: string) => void;
  onSelect: (threadId: string | undefined) => void;
};

export function CanvasComments(props: Props) {
  const [open, setOpen] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const [replyDraft, setReplyDraft] = createSignal("");
  const indexed = createMemo(() => {
    const byId = new Map<string, Element>();
    for (const element of flatten(props.elements)) if (element.id) byId.set(element.id, element);
    return byId;
  });
  const active = () => props.threads.find(thread => thread.id === props.activeThreadId);
  const anchorFor = (thread: ReviewCommentThread) => {
    const element = thread.elementId ? indexed().get(thread.elementId) : undefined;
    if (thread.elementId && !element) return undefined;
    if (!element) return thread.anchor;
    const bounds = elementBounds(element);
    return { x: bounds.x + bounds.w * thread.anchor.x, y: bounds.y + bounds.h * thread.anchor.y };
  };
  const submitNew = (event: SubmitEvent) => {
    event.preventDefault();
    const text = draft().trim();
    if (!text) return;
    const elementId = props.selectedElementId;
    props.onCreate(text, elementId, elementId ? { x: 0.5, y: 0 } : props.canvasAnchor);
    setDraft("");
    setOpen(true);
  };
  const submitReply = (event: SubmitEvent) => {
    event.preventDefault();
    const text = replyDraft().trim(); const thread = active();
    if (!text || !thread) return;
    props.onReply(thread.id, text); setReplyDraft("");
  };

  return <>
    <button type="button" class="canvas-comments-toggle" classList={{ active: open() }} aria-pressed={open()} aria-label={`Comments, ${props.threads.filter(thread => !thread.resolved).length} open`} title="Review comments" onClick={() => { setOpen(value => !value); props.onSelect(undefined); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5h-6l-5 4v-4.2A2.5 2.5 0 0 1 4 13.5z"/><path d="M8 8h8M8 11.5h5"/></svg>
      <span>{props.threads.filter(thread => !thread.resolved).length}</span>
    </button>
    <For each={props.threads}>{thread => {
      const point = () => anchorFor(thread);
      return <Show when={point()}>{anchor => <button type="button" class="canvas-comment-pin" classList={{ resolved: !!thread.resolved, selected: props.activeThreadId === thread.id }} style={{ left: `${props.panX + anchor().x * props.zoom}px`, top: `${props.panY + anchor().y * props.zoom}px` }} aria-label={`Open comment: ${thread.messages[0]?.text ?? "Comment"}`} title={thread.messages[0]?.text} onClick={() => { setOpen(true); props.onSelect(thread.id); }}><span>{thread.messages.length}</span></button>}</Show>;
    }}</For>
    <Show when={open()}>
      <aside class="canvas-comments-panel" aria-label="Canvas review comments" onPointerDown={event => event.stopPropagation()}>
        <header><div><strong>Comments</strong><small>{props.threads.filter(thread => !thread.resolved).length} open</small></div><button type="button" aria-label="Close comments" title="Close comments" onClick={() => { setOpen(false); props.onSelect(undefined); }}>×</button></header>
        <Show when={active()} fallback={<>
          <div class="canvas-comments-list">
            <Show when={props.threads.length} fallback={<p class="canvas-comments-empty">No comments on this page yet.</p>}>
              <For each={[...props.threads].reverse()}>{thread => <button type="button" class="canvas-comment-thread-link" classList={{ resolved: !!thread.resolved }} onClick={() => props.onSelect(thread.id)}>
                <span class="canvas-comment-thread-status" aria-hidden="true">{thread.resolved ? "✓" : "•"}</span><span><strong>{thread.messages[0]?.author || "You"}</strong><span>{thread.messages[0]?.text}</span><small>{thread.messages.length > 1 ? `${thread.messages.length} messages` : new Date(thread.messages[0]?.createdAt ?? Date.now()).toLocaleString()}</small></span>
              </button>}</For>
            </Show>
          </div>
          <Show when={props.editable}><form class="canvas-comment-compose" onSubmit={submitNew}><label for="canvas-comment-new">Add a comment{props.selectedElementId ? " on selection" : " at canvas center"}</label><textarea id="canvas-comment-new" maxlength="10000" rows="2" value={draft()} onInput={event => setDraft(event.currentTarget.value)} placeholder="Write a review comment"/><button type="submit" disabled={!draft().trim()}>Comment</button></form></Show>
        </>}>
          {thread => <div class="canvas-comment-detail">
            <button type="button" class="canvas-comment-back" onClick={() => props.onSelect(undefined)}>‹ All comments</button>
            <div class="canvas-comment-messages"><For each={thread().messages}>{message => <article><strong>{message.author || "You"}</strong><time>{new Date(message.createdAt).toLocaleString()}</time><p>{message.text}</p></article>}</For></div>
            <Show when={props.editable && !thread().resolved}><form class="canvas-comment-compose" onSubmit={submitReply}><label for="canvas-comment-reply">Reply</label><textarea id="canvas-comment-reply" maxlength="10000" rows="2" value={replyDraft()} onInput={event => setReplyDraft(event.currentTarget.value)} placeholder="Write a reply"/><button type="submit" disabled={!replyDraft().trim()}>Reply</button></form></Show>
            <Show when={props.editable}><button type="button" class="canvas-comment-resolve" onClick={() => props.onResolve(thread().id)}>{thread().resolved ? "Reopen thread" : "Resolve thread"}</button></Show>
          </div>}
        </Show>
      </aside>
    </Show>
  </>;
}
