import { ErrorBoundary, type ParentProps } from "solid-js";

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

export function AppErrorBoundary(props: ParentProps) {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <main
          role="alert"
          style={{
            "box-sizing": "border-box",
            "min-height": "100vh",
            padding: "clamp(24px, 6vw, 72px)",
            background: "#f7f8fa",
            color: "#17202a",
            "font-family": "system-ui, sans-serif",
          }}
        >
          <section style={{ "max-width": "680px", margin: "10vh auto" }}>
            <p style={{ color: "#687386", "font-size": "0.8rem", "font-weight": 700, "letter-spacing": "0.12em", "text-transform": "uppercase" }}>
              SketchDraw
            </p>
            <h1 style={{ "font-size": "clamp(1.7rem, 4vw, 2.4rem)", "margin-bottom": "0.5rem" }}>
              SketchDraw couldn’t load
            </h1>
            <p style={{ color: "#526071", "line-height": 1.6 }}>
              An app error stopped the workspace from opening. Reload the app to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ background: "#315bd6", border: 0, "border-radius": "8px", color: "white", cursor: "pointer", "font-size": "1rem", padding: "11px 16px" }}
            >
              Reload SketchDraw
            </button>
            <details style={{ "margin-top": "28px", color: "#526071" }}>
              <summary style={{ cursor: "pointer" }}>Technical details</summary>
              <pre style={{ "max-width": "100%", "overflow-wrap": "anywhere", "overflow-x": "auto", "white-space": "pre-wrap" }}>
                {describeError(error)}
              </pre>
            </details>
          </section>
        </main>
      )}
    >
      {props.children}
    </ErrorBoundary>
  );
}
