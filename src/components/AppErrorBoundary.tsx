import { ErrorBoundary, type ParentProps } from "solid-js";
import { AppStatusScreen } from "./AppStatusScreen";

export function AppErrorBoundary(props: ParentProps) {
  return (
    <ErrorBoundary
      fallback={error => (
        <AppStatusScreen state="error" error={error} action={<button class="app-status-action" type="button" onClick={() => window.location.reload()}>Reload SketchDraw</button>} />
      )}
    >
      {props.children}
    </ErrorBoundary>
  );
}
