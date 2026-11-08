import type { JSX } from "solid-js";
import "./app-status-screen.css";

type Props = {
  state: "loading" | "error";
  title?: string;
  message?: string;
  error?: unknown;
  action?: JSX.Element;
};

export function AppStatusScreen(props: Props) {
  return <main class="app-status-screen" role={props.state === "error" ? "alert" : "status"}>
    <section class="app-status-panel">
      <header class="app-status-brand"><span class="app-status-mark" aria-hidden="true">S</span><div><strong>SketchDraw</strong><small>WORKSPACE</small></div></header>
      <p class="app-status-eyebrow">{props.state === "error" ? "Workspace error" : "Opening workspace"}</p>
      <h1>{props.title ?? (props.state === "error" ? "SketchDraw couldn't load" : "Loading SketchDraw…")}</h1>
      <p class="app-status-message">{props.message ?? (props.state === "error" ? "An app error stopped the workspace from opening. Reload SketchDraw to try again." : "Preparing your workspace…")}</p>
      {props.action}
      {props.error !== undefined && <details class="app-status-details"><summary>Technical details</summary><pre>{props.error instanceof Error ? props.error.stack ?? props.error.message : String(props.error)}</pre></details>}
    </section>
  </main>;
}
