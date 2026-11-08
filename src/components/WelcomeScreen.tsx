import { Show } from "solid-js";
import { displayPathLocation } from "../features/files/paths";
import type { UIDesignSession } from "../features/ui-design/session";
import type { DocumentWorkspaceArea } from "../features/workspace/workspace-types";
import { WorkspaceAreaTabs } from "../features/workspace/WorkspaceAreaTabs";

type Props = {
  planningViewport: boolean;
  uiDesignViewport?: boolean;
  uiDesignSession?: UIDesignSession;
  recentFiles: () => string[];
  recentPlans: () => string[];
  displayNameForPath: (path: string) => string;
  onCreateFile: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onCreatePlan: () => unknown;
  onOpenPlan: () => unknown;
  onOpenRecentPlan: (path: string) => unknown;
  onOpenRecentFile: (path: string) => unknown;
  onCreateUIDesign?: () => unknown;
  onOpenUIDesign?: () => unknown;
  onOpenRecentUIDesign?: (path: string) => unknown;
  onSelectWorkspace: (area: DocumentWorkspaceArea) => void;
};

const Mark = () => <span class="home-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></span>;
const FileMark = () => <span class="home-file-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span>;

export function WelcomeScreen(props: Props) {
  const isUI = () => props.uiDesignViewport === true;
  const isPlanning = () => !isUI() && props.planningViewport;
  const session = () => props.uiDesignSession;
  const uiRecents = () => session()?.recentPaths() ?? [];
  const activeWorkspace = () => isUI() ? "ui-design" : isPlanning() ? "planning" : "canvas";
  const ariaName = () => isUI() ? "UI Design home" : isPlanning() ? "Planning home" : "Canvas home";
  const recentCount = () => isUI() ? uiRecents().length : isPlanning() ? props.recentPlans().length : props.recentFiles().length;

  return <section class="home-screen home-screen-desktop" aria-label={ariaName()}>
    <div class="home-desktop-layout">
      <WorkspaceAreaTabs active={activeWorkspace()} documentTabs={false} onSelect={props.onSelectWorkspace} />
      <section class="home-hero" aria-labelledby="home-title">
        <header class="home-brand"><Mark /><span class="home-brand-name">SketchDraw</span><span class="home-brand-type">{isUI() ? "UI DESIGN" : isPlanning() ? "PLANNING" : "WHITEBOARD"}</span></header>
        <div class="home-hero-main">
          <div class="home-intro">
            <Show when={isUI()} fallback={<Show when={isPlanning()} fallback={<>
              <p class="home-kicker">A CLEAR SPACE TO THINK</p>
              <h1 class="home-title" id="home-title">Think freely.<br /><em>Draw clearly.</em></h1>
              <p class="home-copy">Make diagrams, sketch ideas, and work things out on a fast, flexible whiteboard.</p>
              <div class="home-actions" aria-label="Start or open a whiteboard"><button type="button" class="home-action home-action-primary" onClick={() => void props.onCreateFile()}>Create a sketch <span aria-hidden="true">&rarr;</span></button><button type="button" class="home-action" onClick={props.onOpenFile}>Open a sketch</button></div>
              <div class="home-file-note"><FileMark /><span>Your portable <strong>.sketch</strong> files stay in folders you choose.</span></div>
            </>}>
              <p class="home-kicker">A SPACE FOR THE WORK AHEAD</p>
              <h1 class="home-title" id="home-title">Plan with care.<br /><em>Make progress.</em></h1>
              <p class="home-copy">Keep project notes, tasks, milestones, decisions, and reference files together in a dedicated Planning workspace.</p>
              <div class="home-actions" aria-label="Start or open a plan"><button type="button" class="home-action home-action-primary" onClick={() => void props.onCreatePlan()}>New plan <span aria-hidden="true">&rarr;</span></button><button type="button" class="home-action" onClick={() => void props.onOpenPlan()}>Open plan</button></div>
              <div class="home-file-note"><FileMark /><span>Planning files use the separate <strong>.sdplan</strong> format.</span></div>
            </Show>}>
              <p class="home-kicker">A WORKSPACE FOR INTERFACE DESIGN</p>
              <h1 class="home-title" id="home-title">Shape ideas into<br /><em>real interfaces.</em></h1>
              <p class="home-copy">Design screens, arrange reusable components, tune visual styles, and connect a working prototype on an open canvas.</p>
              <div class="home-actions" aria-label="Start or open a UI design"><button type="button" class="home-action home-action-primary" onClick={() => { if (session()) props.onCreateUIDesign?.(); }}>Create a design <span aria-hidden="true">&rarr;</span></button><button type="button" class="home-action" disabled={session()?.opening()} onClick={() => { if (session()) props.onOpenUIDesign?.(); }}>{session()?.opening() ? "Opening…" : "Open .sdui file"}</button></div>
              <div class="home-file-note"><FileMark /><span>Portable UI Design files use the separate <strong>.sdui</strong> format.</span></div>
            </Show>
          </div>
          <div class="home-preview" aria-hidden="true">
            <div class="home-preview-bar"><span><i /> {isUI() ? "UI DESIGN CANVAS" : isPlanning() ? "PROJECT PLAN" : "UNTITLED BOARD"}</span><span>{isPlanning() ? "THIS WEEK" : "100%"}</span></div>
            <Show when={isUI()} fallback={<Show when={isPlanning()} fallback={<svg class="home-flow" viewBox="0 0 440 300" role="presentation">
              <path class="home-flow-wire" d="M125 87h58m74 0h55M220 111v72m-95 0h190M125 207v32m190-56v56" />
              <path class="home-flow-arrow" d="m176 81 7 6-7 6m74-12 7 6-7 6m-36 78 6 6-6 6m-95 27 6 6-6 6m190-45 6 6-6 6m-190 42 6 6-6 6m190-6 6 6-6 6" />
              <g class="home-flow-cards"><rect class="home-flow-node home-flow-node-primary" x="32" y="54" width="93" height="66" rx="10" /><rect class="home-flow-node home-flow-node-surface" x="183" y="54" width="93" height="66" rx="10" /><rect class="home-flow-node home-flow-node-info" x="312" y="54" width="96" height="66" rx="10" /><rect class="home-flow-node home-flow-node-surface" x="78" y="183" width="94" height="58" rx="10" /><rect class="home-flow-node home-flow-node-success" x="268" y="183" width="94" height="58" rx="10" /></g>
              <g class="home-flow-ink"><circle cx="54" cy="77" r="6" /><path d="M68 76h42m-42 8h29" /><circle cx="205" cy="77" r="6" /><path d="M219 76h42m-42 8h29" /><circle cx="334" cy="77" r="6" /><path d="M348 76h43m-43 8h29" /><circle cx="100" cy="204" r="6" /><path d="M114 203h43m-43 8h29" /><circle cx="290" cy="204" r="6" /><path d="M304 203h43m-43 8h29" /></g>
              <circle class="home-flow-spark" cx="374" cy="31" r="8" /><path class="home-flow-cross" d="M374 26v10m-5-5h10" />
            </svg>}>
              <div class="planning-preview-board"><div class="planning-preview-row"><span class="planning-preview-check">✓</span><span><strong>Set project direction</strong><small>Project note</small></span><i class="done">Done</i></div><div class="planning-preview-row"><span class="planning-preview-check" /><span><strong>Map the next milestone</strong><small>Due Friday</small></span><i class="active">In progress</i></div><div class="planning-preview-row"><span class="planning-preview-check" /><span><strong>Review open decisions</strong><small>3 items</small></span><i>Next</i></div></div>
            </Show>}>
              <div class="home-ui-preview"><div class="home-ui-sidebar"><i /><i /><i /><b /></div><div class="home-ui-board"><div class="home-ui-artboard home-ui-phone"><i /><b /><span /><span /><strong /></div><div class="home-ui-artboard home-ui-desktop"><header><i /><span /><span /><span /></header><div><aside /><section><b /><i /><i /></section></div><strong /></div><span class="home-ui-gap">24 px</span></div></div>
            </Show>
            <div class="home-preview-caption"><span>+</span> {isUI() ? "Compose screens and connect a prototype." : isPlanning() ? "Keep the next steps in view." : "Connect ideas as they come."}</div>
          </div>
        </div>
        <footer class="home-hero-footer"><span class="home-status-dot" /> Private by design <span class="home-footer-separator">·</span> Saved on your device <Show when={!isPlanning()}><small class="home-copyright">© 2026 Toushal Sampat</small></Show></footer>
      </section>

      <section class="home-library" aria-labelledby="home-recent-title">
        <header class="home-library-heading"><div><p class="home-section-label">{isUI() ? "YOUR UI DESIGN" : isPlanning() ? "YOUR PLANNING" : "YOUR WORKSPACE"}</p><h2 id="home-recent-title">{isUI() ? "Recent designs" : isPlanning() ? "Recent plans" : "Recent sketches"}</h2></div><span class="home-count" aria-label={`${recentCount()} recent ${isUI() ? "designs" : isPlanning() ? "plans" : "sketches"}`}>{recentCount()}</span></header>
        <Show when={isUI()} fallback={<Show when={isPlanning()} fallback={<Show when={props.recentFiles().length > 0} fallback={<div class="home-empty"><span class="home-empty-mark" aria-hidden="true"><FileMark /></span><strong>Your sketches will appear here</strong><p>Open a sketch from your device to pick up where you left off.</p><button type="button" class="home-action" onClick={props.onOpenFile}>Browse sketches</button></div>}><div class="home-recent-list" aria-label="Recent sketches">{props.recentFiles().map(path => <button type="button" class="home-file" onClick={() => void props.onOpenRecentFile(path)}><FileMark /><span class="home-file-copy"><strong>{props.displayNameForPath(path)}</strong><small>{displayPathLocation(path)}</small></span><span class="home-file-open">Open <span aria-hidden="true">&rarr;</span></span></button>)}</div></Show>}>
          <Show when={props.recentPlans().length > 0} fallback={<div class="home-empty"><span class="home-empty-mark" aria-hidden="true"><FileMark /></span><strong>Your plans will appear here</strong><p>Create a plan or open an .sdplan file to get started.</p><button type="button" class="home-action" onClick={() => void props.onOpenPlan()}>Browse plans</button></div>}><div class="home-recent-list" aria-label="Recent Planning files">{props.recentPlans().map(path => <button type="button" class="home-file" onClick={() => void props.onOpenRecentPlan(path)}><FileMark /><span class="home-file-copy"><strong>{props.displayNameForPath(path)}</strong><small>{displayPathLocation(path)}</small></span><span class="home-file-open">Open <span aria-hidden="true">&rarr;</span></span></button>)}</div></Show>
        </Show>}>
          <Show when={session()?.error()}><div class="home-session-error" role="alert">{session()?.error()}</div></Show>
          <Show when={session()?.recoveryAvailable()}><div class="home-session-card is-recovery" role="status"><div><strong>A recovered design is ready</strong><p>Your unsaved UI Design draft is saved on this device.</p></div><button type="button" class="home-action home-action-primary" onClick={() => session()?.restoreRecovery()}>Restore draft</button><button type="button" class="home-session-dismiss" onClick={() => session()?.dismissRecovery()}>Discard</button></div></Show>
          <Show when={session()?.hasDocument()}><div class="home-session-card"><div><strong>{session()?.fileName()}</strong><p>{session()?.dirty() ? "Unsaved changes · draft saved on this device" : session()?.savedAt() ? `Saved ${session()?.savedAt()}` : "Ready to continue editing"}</p></div><button type="button" class="home-action" onClick={() => session()?.continueEditing()}>Continue editing <span aria-hidden="true">&rarr;</span></button><button type="button" class="home-session-save" disabled={session()?.saving()} onClick={() => void session()?.save()}>{session()?.saving() ? "Saving…" : "Save"}</button></div></Show>
          <Show when={uiRecents().length > 0} fallback={<div class="home-empty"><span class="home-empty-mark" aria-hidden="true"><FileMark /></span><strong>Your designs will appear here</strong><p>Open a .sdui file to add it to your recent designs.</p><button type="button" class="home-action" onClick={() => { if (session()) props.onOpenUIDesign?.(); }}>Browse designs</button></div>}><div class="home-recent-list" aria-label="Recent UI designs">{uiRecents().map(path => <button type="button" class="home-file" disabled={session()?.opening()} onClick={() => { if (session()) props.onOpenRecentUIDesign?.(path); }}><FileMark /><span class="home-file-copy"><strong>{session()?.recentDisplayName(path)}</strong><small>{displayPathLocation(path)}</small></span><span class="home-file-open">Open <span aria-hidden="true">&rarr;</span></span></button>)}</div></Show>
        </Show>
      </section>
    </div>
  </section>;
}
