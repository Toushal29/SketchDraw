import { Show } from "solid-js";

type Props = {
  recentFiles: () => string[];
  displayNameForPath: (path: string) => string;
  onCreateFile: () => void;
  onOpenFile: () => void;
  onCreateProject: () => unknown;
  onOpenRecentProject: (path: string) => unknown;
  onOpenRecentFile: (path: string) => unknown;
};

export function WelcomeScreen(props: Props) {
  return <section class="welcome-screen">
    <div class="welcome-card">
      <div class="welcome-intro">
        <div class="welcome-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></div>
        <p class="eyebrow">YOUR IDEAS, ON ONE CANVAS</p>
        <h1>Think it through.<br /><em>Draw it out.</em></h1>
        <p class="welcome-copy">A calm, capable space for diagrams, plans, and the ideas in between. Start a sketch or pick up where you left off.</p>
        <div class="welcome-actions"><button type="button" class="save-button large" onClick={props.onCreateFile}>Create a sketch <span aria-hidden="true">&rarr;</span></button><button type="button" class="quiet-button large" onClick={props.onOpenFile}>Open a file</button></div>
        <div class="file-hint"><span class="file-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span><strong>Private by design</strong><br />Your portable .sketch files stay in folders you choose.</span></div>
        <small class="copyright-notice">&copy; 2026 Toushal Sampat. All rights reserved.</small>
      </div>
      <div class="welcome-visual" aria-hidden="true">
        <div class="welcome-visual-topline"><span><i></i> SKETCHDRAW CANVAS</span><b>FLOW 01</b></div>
        <svg viewBox="0 0 440 350" role="presentation">
          <path class="welcome-wire" d="M116 111h53m62 0h46m-77 25v52m93-52v52m-93 0h-90m90 0h94m-184 0v32m184-32v32" />
          <path class="welcome-wire-arrow" d="m163 106 7 5-7 5m47 65 5 7 5-7m87-65 7 5-7 5m-200 63-5 7 5 7m99 15 5 7 5-7m85-29 5 7 5-7" />
          <g class="welcome-node-cards"><rect class="welcome-node welcome-node-lilac" x="26" y="78" width="90" height="66" rx="16" /><rect class="welcome-node welcome-node-sun" x="169" y="78" width="92" height="66" rx="16" /><rect class="welcome-node welcome-node-mint" x="277" y="78" width="104" height="66" rx="16" /><rect class="welcome-node welcome-node-paper" x="26" y="198" width="100" height="64" rx="16" /><rect class="welcome-node welcome-node-blue" x="169" y="198" width="92" height="64" rx="16" /><rect class="welcome-node welcome-node-paper" x="277" y="198" width="104" height="64" rx="16" /></g>
          <g class="welcome-node-icon"><circle cx="48" cy="101" r="7" /><path d="M62 99h38M62 106h27" /><circle cx="191" cy="101" r="7" /><path d="M205 99h40M205 106h28" /><circle cx="299" cy="101" r="7" /><path d="M313 99h52M313 106h35" /><circle cx="48" cy="220" r="7" /><path d="M62 218h42M62 225h30" /><circle cx="191" cy="220" r="7" /><path d="M205 218h40M205 225h28" /><circle cx="299" cy="220" r="7" /><path d="M313 218h52M313 225h35" /></g>
          <circle class="welcome-spark" cx="365" cy="53" r="13" /><path class="welcome-spark-line" d="M365 45v16m-8-8h16m-13-5 10 10m0-10-10 10" />
          <circle class="welcome-dot" cx="80" cy="290" r="4" /><circle class="welcome-dot" cx="96" cy="290" r="4" /><circle class="welcome-dot" cx="112" cy="290" r="4" />
        </svg>
        <div class="welcome-visual-caption"><span>&#10022;</span> A little clarity, one connection at a time.</div>
      </div>
    </div>
    <div class="recent-dashboard">
      <div class="recent-heading"><span class="eyebrow">YOUR WORKSPACE</span><div class="recent-heading-row"><h2>Recent sketches</h2><span class="recent-count">{props.recentFiles().length}</span></div><p>Pick up right where you left off.</p></div>
      <section class="home-project-hub" aria-labelledby="home-project-title">
        <span class="home-project-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7.5h6l2 2h8v9H4zM4 10h16M8 13h3m-3 2.5h7" /></svg></span>
        <div class="home-project-copy"><span class="eyebrow">PROJECT SPACE</span><h2 id="home-project-title">A home for each project</h2><p>Keep notes, tasks, schedules, decisions, and reference files beside the sketch.</p></div>
        <div class="home-project-actions"><button type="button" class="save-button" onClick={() => void props.onCreateProject()}>New project <span aria-hidden="true">&rarr;</span></button><Show when={props.recentFiles().length > 0}><button type="button" class="quiet-button" onClick={() => void props.onOpenRecentProject(props.recentFiles()[0])}>Open recent <span aria-hidden="true">&rarr;</span></button></Show></div>
      </section>
      <Show when={props.recentFiles().length > 0} fallback={<div class="recent-empty"><div class="recent-empty-icon"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></div><strong>Your next idea starts here</strong><span>Open a sketch from your device to see it in this list.</span><button type="button" class="quiet-button" onClick={props.onOpenFile}>Browse sketches <span aria-hidden="true">&rarr;</span></button></div>}>
        <div class="recent-list">{props.recentFiles().map(path => <button type="button" class="recent-file" onClick={() => void props.onOpenRecentFile(path)}><span class="recent-file-icon"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span class="recent-file-name">{props.displayNameForPath(path)}</span><span class="recent-file-path">{/^content:\/\//i.test(path) ? "Cloud drive or device folder" : path}</span><span class="recent-open">Open <span aria-hidden="true">&rarr;</span></span></button>)}</div>
      </Show>
      <div class="recent-footnote"><span class="recent-footnote-dot"></span> Saved on this device</div>
    </div>
  </section>;
}
