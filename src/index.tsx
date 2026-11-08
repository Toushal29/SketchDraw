/* @refresh reload */
import { lazy, Suspense } from "solid-js";
import { render } from "solid-js/web";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppStatusScreen } from "./components/AppStatusScreen";
import "./styles/app/theme.css";

const App = lazy(() => import("./App"));
const root = document.getElementById("root");

if (!root) throw new Error("SketchDraw could not find its app root element.");

root.replaceChildren();
render(
  () => (
    <AppErrorBoundary>
      <Suspense fallback={<AppStatusScreen state="loading" />}>
        <App />
      </Suspense>
    </AppErrorBoundary>
  ),
  root,
);
