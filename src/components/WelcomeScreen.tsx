import { Show } from "solid-js";
import { displayPathLocation } from "../features/files/paths";

type Props = {
  recentFiles: () => string[];
  recentPlans: () => string[];
  displayNameForPath: (path: string) => string;
  onCreateFile: () => void;
  onGuides: () => void;
  onOpenFile: () => void;
  onCreatePlan: () => unknown;
  onOpenPlan: () => unknown;
  onOpenRecentPlan: (path: string) => unknown;
  onOpenRecentFile: (path: string) => unknown;
};

export function WelcomeScreen(props: Props) {
  return <section class="home-screen home-screen-desktop" aria-label="SketchDraw home">
    <div class="home-desktop-layout">
      <section class="home-hero" aria-labelledby="home-title">
        <header class="home-brand">
          <span class="home-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></span>
          <span class="home-brand-name">SketchDraw</span>
          <span class="home-brand-type">WHITEBOARD</span>
        </header>

        <div class="home-hero-main">
          <div class="home-intro">
            <p class="home-kicker">A CLEAR SPACE TO THINK</p>
            <h1 class="home-title" id="home-title">Think freely.<br /><em>Draw clearly.</em></h1>
            <p class="home-copy">Make diagrams, sketch ideas, and work things out on a fast, flexible whiteboard.</p>
            <div class="home-actions" aria-label="Start or open a whiteboard">
              <button type="button" class="home-action home-action-primary" onClick={() => void props.onCreateFile()}>Create a sketch <span aria-hidden="true">&rarr;</span></button>
              <button type="button" class="home-action home-action-secondary" onClick={props.onGuides}>Diagram guides</button>
              <button type="button" class="home-action home-action-secondary" onClick={props.onOpenFile}>Open a sketch</button>
            </div>
            <div class="home-file-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg><span>Your portable <strong>.sketch</strong> files stay in folders you choose.</span></div>
          </div>

          <div class="home-preview" aria-hidden="true">
            <div class="home-preview-bar"><span><i></i> UNTITLED BOARD</span><span>100%</span></div>
            <svg class="home-flow" viewBox="0 0 440 300" role="presentation">
              <path class="home-flow-wire" d="M125 87h58m74 0h55M220 111v72m-95 0h190M125 207v32m190-56v56" />
              <path class="home-flow-arrow" d="m176 81 7 6-7 6m74-12 7 6-7 6m-36 78 6 6-6 6m-95 27 6 6-6 6m190-45 6 6-6 6m-190 42 6 6-6 6m190-6 6 6-6 6" />
              <g class="home-flow-cards">
                <rect class="home-flow-node home-flow-node-primary" x="32" y="54" width="93" height="66" rx="10" />
                <rect class="home-flow-node home-flow-node-surface" x="183" y="54" width="93" height="66" rx="10" />
                <rect class="home-flow-node home-flow-node-info" x="312" y="54" width="96" height="66" rx="10" />
                <rect class="home-flow-node home-flow-node-surface" x="78" y="183" width="94" height="58" rx="10" />
                <rect class="home-flow-node home-flow-node-success" x="268" y="183" width="94" height="58" rx="10" />
              </g>
              <g class="home-flow-ink">
                <circle cx="54" cy="77" r="6" /><path d="M68 76h42m-42 8h29" />
                <circle cx="205" cy="77" r="6" /><path d="M219 76h42m-42 8h29" />
                <circle cx="334" cy="77" r="6" /><path d="M348 76h43m-43 8h29" />
                <circle cx="100" cy="204" r="6" /><path d="M114 203h43m-43 8h29" />
                <circle cx="290" cy="204" r="6" /><path d="M304 203h43m-43 8h29" />
              </g>
              <circle class="home-flow-spark" cx="374" cy="31" r="8" />
              <path class="home-flow-cross" d="M374 26v10m-5-5h10" />
            </svg>
            <div class="home-preview-caption"><span>+</span> Connect ideas as they come.</div>
          </div>
        </div>

        <footer class="home-hero-footer"><span class="home-status-dot"></span> Private by design <span class="home-footer-separator">&middot;</span> Saved on your device <small class="home-copyright">&copy; 2026 Toushal Sampat</small></footer>
      </section>

      <section class="home-library" aria-labelledby="home-recent-title">
        <header class="home-library-heading">
          <div><p class="home-section-label">YOUR WORKSPACE</p><h2 id="home-recent-title">Recent sketches</h2></div>
          <span class="home-count" aria-label={`${props.recentFiles().length} recent sketches`}>{props.recentFiles().length}</span>
        </header>
        <Show when={props.recentFiles().length > 0} fallback={
          <div class="home-empty">
            <span class="home-empty-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span>
            <strong>Your sketches will appear here</strong>
            <p>Open a sketch from your device to pick up where you left off.</p>
            <button type="button" class="home-action home-action-secondary" onClick={props.onOpenFile}>Browse sketches</button>
          </div>
        }>
          <div class="home-recent-list" aria-label="Recent sketches">{props.recentFiles().map(path => <button type="button" class="home-file" onClick={() => void props.onOpenRecentFile(path)}>
            <span class="home-file-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span>
            <span class="home-file-copy"><strong>{props.displayNameForPath(path)}</strong><small>{displayPathLocation(path)}</small></span>
            <span class="home-file-open">Open <span aria-hidden="true">&rarr;</span></span>
          </button>)}</div>
        </Show>

        <section class="home-planning" aria-labelledby="home-planning-title">
          <div class="home-planning-copy"><h3 id="home-planning-title">Planning</h3><p>Notes and tasks in separate .sdplan files.</p></div>
          <div class="home-planning-actions"><button type="button" onClick={() => void props.onCreatePlan()}>New plan</button><button type="button" onClick={() => void props.onOpenPlan()}>Open plan</button></div>
          <Show when={props.recentPlans().length > 0}><div class="home-planning-recents" aria-label="Recent Planning files">{props.recentPlans().slice(0, 2).map(path => <button type="button" onClick={() => void props.onOpenRecentPlan(path)}>{props.displayNameForPath(path)}</button>)}</div></Show>
        </section>
      </section>
    </div>
  </section>;
}
