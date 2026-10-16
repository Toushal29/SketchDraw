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
        <div class="mobile-home-primary">
          <header class="mobile-home-intro">
            <span class="mobile-home-eyebrow">SKETCHDRAW WORKSPACE</span>
            <h1>What would you like to make?</h1>
            <p>Start with a fresh canvas or continue a sketch.</p>
          </header>

          <div class="mobile-home-actions" aria-label="Start or open a sketch">
            <button class="mobile-home-action primary" type="button" onClick={() => void props.onCreate()}>
              <span class="mobile-home-action-copy"><strong>New sketch</strong><small>Start with a blank canvas</small></span>
            </button>
            <button class="mobile-home-action secondary" type="button" onClick={() => void props.onOpen()}>
              <span class="mobile-home-action-copy"><strong>Open a sketch</strong><small>Browse files on this device</small></span>
            </button>
          </div>

          <section class="mobile-home-project" aria-labelledby="mobile-home-project-title">
            <div><span class="mobile-home-eyebrow">PROJECTS</span><h2 id="mobile-home-project-title">More than a canvas</h2><p>Keep notes, tasks, milestones, decisions, and files with a sketch in one project space.</p></div>
            <button type="button" onClick={() => void props.onNewProject()}>New project</button>
          </section>
        </div>

        <section class="mobile-home-recent" aria-labelledby="mobile-home-recent-title">
          <header class="mobile-home-section-heading">
            <div><span class="mobile-home-eyebrow">YOUR WORK</span><h2 id="mobile-home-recent-title">Recent sketches</h2></div>
            <span class="mobile-home-count" aria-label={`${props.recentFiles.length} recent sketches`}>{props.recentFiles.length}</span>
          </header>
          <Show when={props.recentFiles.length > 0} fallback={
            <div class="mobile-home-empty">
              <div><strong>Your recent sketches will appear here</strong><p>Open a .sketch file from your device to get started.</p></div>
            </div>
          }>
            <div class="mobile-home-recent-list">
              <For each={props.recentFiles}>{path =>
                <div class="mobile-home-recent-row">
                <button class="mobile-home-recent-item" type="button" onClick={() => void props.onOpenRecent(path)}>
                  <span class="mobile-home-file-copy"><strong>{props.displayPathName(path)}</strong><small>{/^content:\/\//i.test(path) ? "Cloud or device document" : "On this device"}</small></span>
                </button>
                <button class="mobile-home-project-link" type="button" onClick={() => void props.onOpenRecentProject(path)}>Project</button>
                </div>
              }</For>
            </div>
          </Show>
        </section>

        <footer class="mobile-home-footer"><span>Private by design</span><span>Save files where you choose.</span></footer>
      </div>
    </section>
  );
}
