/* @refresh reload */
import { lazy, Suspense } from "solid-js";
import { render } from "solid-js/web";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

const App = lazy(() => import("./App"));
const root = document.getElementById("root");

if (!root) throw new Error("SketchDraw could not find its app root element.");

root.replaceChildren();
render(
  () => (
    <AppErrorBoundary>
      <Suspense fallback={<main role="status" style={{ padding: "32px", color: "#526071", "font-family": "var(--font-ui, system-ui, sans-serif)", "font-size": "var(--type-body-compact, 13px)", "font-weight": "var(--font-weight-regular, 400)", "line-height": "var(--leading-normal, 1.5)" }}>Loading SketchDraw…</main>}>
        <App />
      </Suspense>
    </AppErrorBoundary>
  ),
  root,
);
