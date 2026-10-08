import { For, Show } from "solid-js";

type Props = {
  recentFiles: string[];
  displayPathName: (path: string) => string;
  onCreate: () => void | Promise<void>;
  onNewProject: () => void | Promise<void>;
  onOpen: () => void | Promise<void>;
  onOpenRecent: (path: string) => void | Promise<void>;
  onOpenRecentProject: (path: string) => void | Promise<void>;
};

export function MobileHomeScreen(props: Props) {
  return (
    <section class="mobile-home-screen" aria-label="SketchDraw home">
      <div class="mobile-home-layout">
        <header class="mobile-home-intro">
          <span class="mobile-home-eyebrow"><i aria-hidden="true" /> SKETCHDRAW WORKSPACE</span>
          <h1>What would you like to make?</h1>
          <p>Start with a fresh canvas or continue a sketch.</p>
        </header>

        <div class="mobile-home-actions" aria-label="Start or open a sketch">
          <button class="mobile-home-action primary" type="button" onClick={() => void props.onCreate()}>
            <span class="mobile-home-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></span>
            <span class="mobile-home-action-copy"><strong>New sketch</strong><small>Start with a blank canvas</small></span>
            <svg class="mobile-home-action-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </button>
          <button class="mobile-home-action secondary" type="button" onClick={() => void props.onOpen()}>
            <span class="mobile-home-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h5l2 2h5.9a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2zM3.5 10h16" /></svg></span>
            <span class="mobile-home-action-copy"><strong>Open a sketch</strong><small>Browse files on this device</small></span>
            <svg class="mobile-home-action-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </button>
        </div>

        <section class="mobile-home-project" aria-labelledby="mobile-home-project-title">
          <span class="mobile-home-project-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7.5h6l2 2h8v9H4zM4 10h16M8 13h3m-3 2.5h7" /></svg></span>
          <div><span class="mobile-home-eyebrow">PROJECTS</span><h2 id="mobile-home-project-title">More than a canvas</h2><p>Keep notes, tasks, milestones, decisions, and files with a sketch in one project space.</p></div>
          <button type="button" onClick={() => void props.onNewProject()}>New project <span aria-hidden="true">&rarr;</span></button>
        </section>

        <section class="mobile-home-recent" aria-labelledby="mobile-home-recent-title">
          <header class="mobile-home-section-heading">
            <div><span class="mobile-home-eyebrow">YOUR WORK</span><h2 id="mobile-home-recent-title">Recent sketches</h2></div>
            <span class="mobile-home-count" aria-label={`${props.recentFiles.length} recent sketches`}>{props.recentFiles.length}</span>
          </header>
          <Show when={props.recentFiles.length > 0} fallback={
            <div class="mobile-home-empty">
              <span class="mobile-home-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4v13H6zM14 3.5v5h5M9 13h6m-6 3h6" /></svg></span>
              <div><strong>Your recent sketches will appear here</strong><p>Open a .sketch file from your device to get started.</p></div>
            </div>
          }>
            <div class="mobile-home-recent-list">
              <For each={props.recentFiles}>{path =>
                <div class="mobile-home-recent-row">
                <button class="mobile-home-recent-item" type="button" onClick={() => void props.onOpenRecent(path)}>
                  <span class="mobile-home-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4v13H6zM14 3.5v5h5M9 13h6m-6 3h4" /></svg></span>
                  <span class="mobile-home-file-copy"><strong>{props.displayPathName(path)}</strong><small>Sketch document</small></span>
                  <svg class="mobile-home-recent-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
                </button>
                <button class="mobile-home-project-link" type="button" onClick={() => void props.onOpenRecentProject(path)}>Project</button>
                </div>
              }</For>
            </div>
          </Show>
        </section>

        <footer class="mobile-home-footer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 7h14M5 17h14" /></svg><span>Private by design</span><i /> <span>Your files stay on this device.</span></footer>
      </div>
    </section>
  );
}
