import { For, Show } from "solid-js";
import { displayPathLocation } from "../../features/files/paths";
import type { UIDesignSession } from "../../features/ui-design/session";

type Props = {
  planningViewport: boolean;
  uiDesignViewport?: boolean;
  uiDesignSession?: UIDesignSession;
  recentFiles: string[];
  recentPlans: string[];
  displayPathName: (path: string) => string;
  onCreate: () => void | Promise<void>;
  onNewPlan: () => void | Promise<void>;
  onOpenPlan: () => void | Promise<void>;
  onOpen: () => void | Promise<void>;
  onOpenRecent: (path: string) => void | Promise<void>;
  onOpenRecentPlan: (path: string) => void | Promise<void>;
  onCreateUIDesign?: () => unknown;
  onOpenUIDesign?: () => unknown;
  onOpenRecentUIDesign?: (path: string) => unknown;
};

const Mark = () => <span class="home-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></span>;

export function MobileHomeScreen(props: Props) {
  return <Show when={props.uiDesignViewport} fallback={<Show when={props.planningViewport} fallback={
    <section class="home-screen home-screen-mobile" aria-label="Canvas home">
      <div class="home-mobile-layout">
        <section class="home-mobile-hero" aria-labelledby="home-mobile-title">
          <header class="home-brand"><Mark /><span class="home-brand-name">SketchDraw</span><span class="home-brand-type">WHITEBOARD</span></header>
          <div class="home-mobile-intro"><p class="home-kicker">YOUR IDEAS START HERE</p><h1 class="home-title" id="home-mobile-title">What would you like to make?</h1><p class="home-copy">Start a fresh whiteboard or continue a sketch.</p></div>
          <div class="home-actions home-actions-mobile" aria-label="Start or open a whiteboard"><button class="home-action home-action-primary" type="button" onClick={() => void props.onCreate()}><span>New sketch</span><span aria-hidden="true">&rarr;</span></button><button class="home-action" type="button" onClick={() => void props.onOpen()}><span>Open sketch</span><span aria-hidden="true">&rarr;</span></button></div>
        </section>
        <section class="home-library home-library-mobile" aria-labelledby="home-mobile-recent-title">
          <header class="home-library-heading"><div><p class="home-section-label">YOUR WORKSPACE</p><h2 id="home-mobile-recent-title">Recent sketches</h2></div><span class="home-count" aria-label={`${props.recentFiles.length} recent sketches`}>{props.recentFiles.length}</span></header>
          <Show when={props.recentFiles.length > 0} fallback={<div class="home-empty home-empty-mobile"><strong>Your sketches will appear here</strong><p>Open a .sketch file to see it in this list.</p></div>}>
            <div class="home-recent-list" aria-label="Recent sketches"><For each={props.recentFiles}>{path => <button type="button" class="home-file home-file-mobile" onClick={() => void props.onOpenRecent(path)}><span class="home-file-copy"><strong>{props.displayPathName(path)}</strong><small>{displayPathLocation(path)}</small></span><span class="home-file-open" aria-hidden="true">&rarr;</span></button>}</For></div>
          </Show>
        </section>
        <footer class="home-mobile-footer"><span class="home-status-dot"></span> Sketch files stay on your device.</footer>
      </div>
    </section>
  }>
    <section class="home-screen home-screen-mobile home-planning-mobile-screen" aria-label="Planning home">
      <div class="home-mobile-layout">
        <section class="home-mobile-hero" aria-labelledby="planning-mobile-title">
          <header class="home-brand"><Mark /><span class="home-brand-name">SketchDraw</span><span class="home-brand-type">PLANNING</span></header>
          <div class="home-mobile-intro"><p class="home-kicker">A SPACE FOR THE WORK AHEAD</p><h1 class="home-title" id="planning-mobile-title">Plan with care. Make progress.</h1><p class="home-copy">Keep project notes, tasks, milestones, decisions, and reference files together.</p></div>
          <div class="home-actions home-actions-mobile" aria-label="Start or open a plan"><button class="home-action home-action-primary" type="button" onClick={() => void props.onNewPlan()}><span>New plan</span><span aria-hidden="true">&rarr;</span></button><button class="home-action" type="button" onClick={() => void props.onOpenPlan()}><span>Open plan</span><span aria-hidden="true">&rarr;</span></button></div>
        </section>
        <section class="home-library home-library-mobile" aria-labelledby="planning-mobile-recent-title">
          <header class="home-library-heading"><div><p class="home-section-label">YOUR PLANNING</p><h2 id="planning-mobile-recent-title">Recent plans</h2></div><span class="home-count" aria-label={`${props.recentPlans.length} recent plans`}>{props.recentPlans.length}</span></header>
          <Show when={props.recentPlans.length > 0} fallback={<div class="home-empty home-empty-mobile"><strong>Your plans will appear here</strong><p>Create a plan or open an .sdplan file to see it here.</p></div>}>
            <div class="home-recent-list" aria-label="Recent Planning files"><For each={props.recentPlans}>{path => <button type="button" class="home-file home-file-mobile" onClick={() => void props.onOpenRecentPlan(path)}><span class="home-file-copy"><strong>{props.displayPathName(path)}</strong><small>{displayPathLocation(path)}</small></span><span class="home-file-open" aria-hidden="true">&rarr;</span></button>}</For></div>
          </Show>
        </section>
        <footer class="home-mobile-footer"><span class="home-status-dot"></span> Planning files stay separate in .sdplan files.</footer>
      </div>
    </section>
  </Show>}>
    <section class="home-screen home-screen-mobile home-ui-design-mobile-screen" aria-label="UI Design home">
      <div class="home-mobile-layout">
        <section class="home-mobile-hero" aria-labelledby="ui-mobile-title">
          <header class="home-brand"><Mark /><span class="home-brand-name">SketchDraw</span><span class="home-brand-type">UI DESIGN</span></header>
          <div class="home-mobile-intro"><p class="home-kicker">A WORKSPACE FOR INTERFACE DESIGN</p><h1 class="home-title" id="ui-mobile-title">Shape ideas into real interfaces.</h1><p class="home-copy">Create screens, build components, and connect interactive prototypes.</p></div>
          <div class="home-actions home-actions-mobile" aria-label="Start or open a UI design"><button class="home-action home-action-primary" type="button" onClick={() => void props.onCreateUIDesign?.()}><span>Create a design</span><span aria-hidden="true">&rarr;</span></button><button class="home-action" type="button" onClick={() => void props.onOpenUIDesign?.()}><span>Open .sdui file</span><span aria-hidden="true">&rarr;</span></button></div>
        </section>
        <section class="home-library home-library-mobile" aria-labelledby="ui-mobile-recent-title">
          <header class="home-library-heading"><div><p class="home-section-label">YOUR UI DESIGN</p><h2 id="ui-mobile-recent-title">Recent designs</h2></div><span class="home-count">{props.uiDesignSession?.recentPaths().length ?? 0}</span></header>
          <Show when={props.uiDesignSession?.error()}><div class="home-session-error" role="alert">{props.uiDesignSession?.error()}</div></Show>
          <Show when={props.uiDesignSession?.recoveryAvailable()}><div class="home-session-card is-recovery" role="status"><div><strong>A recovered design is ready</strong><p>Your unsaved draft is saved on this device.</p></div><button class="home-session-save" type="button" onClick={() => props.uiDesignSession?.restoreRecovery()}>Restore</button><button class="home-session-dismiss" type="button" onClick={() => props.uiDesignSession?.dismissRecovery()}>Discard</button></div></Show>
          <Show when={props.uiDesignSession?.hasDocument()}><div class="home-session-card"><div><strong>{props.uiDesignSession?.fileName()}</strong><p>{props.uiDesignSession?.dirty() ? "Unsaved changes · draft saved locally" : "Ready to continue editing"}</p></div><button class="home-session-save" type="button" onClick={() => props.uiDesignSession?.continueEditing()}>Continue</button><button class="home-session-dismiss" type="button" disabled={props.uiDesignSession?.saving()} onClick={() => void props.uiDesignSession?.save()}>Save</button></div></Show>
          <Show when={(props.uiDesignSession?.recentPaths().length ?? 0) > 0} fallback={<div class="home-empty home-empty-mobile"><strong>Your designs will appear here</strong><p>Create a design or open a .sdui file to get started.</p></div>}>
            <div class="home-recent-list" aria-label="Recent UI designs">{props.uiDesignSession?.recentPaths().map(path => <button type="button" class="home-file home-file-mobile" onClick={() => void props.onOpenRecentUIDesign?.(path)}><span class="home-file-copy"><strong>{props.uiDesignSession?.recentDisplayName(path)}</strong><small>{displayPathLocation(path)}</small></span><span class="home-file-open" aria-hidden="true">&rarr;</span></button>)}</div>
          </Show>
        </section>
        <footer class="home-mobile-footer"><span class="home-status-dot" /> UI Design files use the separate .sdui format.</footer>
      </div>
    </section>
  </Show>;
}
