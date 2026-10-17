import { For, Show } from "solid-js";

type Props = {
  recentFiles: string[];
  recentPlans: string[];
  displayPathName: (path: string) => string;
  onCreate: () => void | Promise<void>;
  onNewPlan: () => void | Promise<void>;
  onOpenPlan: () => void | Promise<void>;
  onOpen: () => void | Promise<void>;
  onOpenRecent: (path: string) => void | Promise<void>;
  onOpenRecentPlan: (path: string) => void | Promise<void>;
};

export function MobileHomeScreen(props: Props) {
  return <section class="home-screen home-screen-mobile" aria-label="SketchDraw home">
    <div class="home-mobile-layout">
      <section class="home-mobile-hero" aria-labelledby="home-mobile-title">
        <header class="home-brand">
          <span class="home-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></span>
          <span class="home-brand-name">SketchDraw</span>
          <span class="home-brand-type">WHITEBOARD</span>
        </header>
        <div class="home-mobile-intro">
          <p class="home-kicker">YOUR IDEAS START HERE</p>
          <h1 class="home-title" id="home-mobile-title">What would you like to make?</h1>
          <p class="home-copy">Start a fresh whiteboard or continue a sketch.</p>
        </div>
        <div class="home-actions home-actions-mobile" aria-label="Start or open a whiteboard">
          <button class="home-action home-action-primary" type="button" onClick={() => void props.onCreate()}><span>New sketch</span><span aria-hidden="true">&rarr;</span></button>
          <button class="home-action home-action-secondary" type="button" onClick={() => void props.onOpen()}><span>Open sketch</span><span aria-hidden="true">&rarr;</span></button>
        </div>
      </section>

      <section class="home-library home-library-mobile" aria-labelledby="home-mobile-recent-title">
        <header class="home-library-heading">
          <div><p class="home-section-label">YOUR WORKSPACE</p><h2 id="home-mobile-recent-title">Recent sketches</h2></div>
          <span class="home-count" aria-label={`${props.recentFiles.length} recent sketches`}>{props.recentFiles.length}</span>
        </header>
        <Show when={props.recentFiles.length > 0} fallback={<div class="home-empty home-empty-mobile"><strong>Your sketches will appear here</strong><p>Open a .sketch file to see it in this list.</p></div>}>
          <div class="home-recent-list" aria-label="Recent sketches"><For each={props.recentFiles}>{path =>
            <button type="button" class="home-file home-file-mobile" onClick={() => void props.onOpenRecent(path)}>
              <span class="home-file-copy"><strong>{props.displayPathName(path)}</strong><small>{/^content:\/\//i.test(path) ? "Cloud drive or device folder" : "On this device"}</small></span>
              <span class="home-file-open" aria-hidden="true">&rarr;</span>
            </button>
          }</For></div>
        </Show>
      </section>

      <section class="home-planning home-planning-mobile" aria-labelledby="home-mobile-planning-title">
        <div class="home-planning-copy"><h2 id="home-mobile-planning-title">Planning</h2><p>A separate space for notes and tasks.</p></div>
        <div class="home-planning-actions"><button type="button" onClick={() => void props.onNewPlan()}>New</button><button type="button" onClick={() => void props.onOpenPlan()}>Open</button></div>
        <Show when={props.recentPlans.length > 0}><div class="home-planning-recents" aria-label="Recent Planning files"><For each={props.recentPlans.slice(0, 2)}>{path => <button type="button" onClick={() => void props.onOpenRecentPlan(path)}>{props.displayPathName(path)}</button>}</For></div></Show>
      </section>

      <footer class="home-mobile-footer"><span class="home-status-dot"></span> Sketch files stay on your device.</footer>
    </div>
  </section>;
}
