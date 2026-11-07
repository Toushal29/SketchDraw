import { For, Show } from "solid-js";
import { displayPathLocation } from "../../features/files/paths";

type Props = {
  planningViewport: boolean;
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

const Mark = () => <span class="home-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></span>;

export function MobileHomeScreen(props: Props) {
  return <Show when={props.planningViewport} fallback={
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
  </Show>;
}
