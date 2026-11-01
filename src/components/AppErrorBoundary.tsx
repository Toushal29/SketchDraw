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
            background: "var(--theme-background)",
            color: "var(--theme-text-primary)",
            "font-family": "var(--font-ui, system-ui, sans-serif)",
            "font-size": "var(--type-body-compact, 13px)",
            "font-weight": "var(--font-weight-regular, 400)",
            "line-height": "var(--leading-normal, 1.5)",
          }}
        >
          <section style={{ "max-width": "680px", margin: "10vh auto" }}>
            <p style={{ color: "var(--theme-text-tertiary)", "font-size": "var(--type-caption, 11px)", "font-weight": "var(--font-weight-bold, 700)", "letter-spacing": "0.12em", "text-transform": "uppercase" }}>
              SketchDraw
            </p>
            <h1 style={{ "font-size": "clamp(1.7rem, 4vw, 2.4rem)", "line-height": "var(--leading-tight, 1.2)", "font-weight": "var(--font-weight-bold, 700)", "margin-bottom": "0.5rem" }}>
              SketchDraw couldn’t load
            </h1>
            <p style={{ color: "var(--theme-text-secondary)", "line-height": "var(--leading-relaxed, 1.6)" }}>
              An app error stopped the workspace from opening. Reload the app to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ background: "var(--theme-primary)", border: 0, "border-radius": "var(--ui-radius-control, 7px)", color: "var(--theme-primary-contrast)", cursor: "pointer", "font-size": "var(--type-body-compact, 13px)", "font-weight": "var(--font-weight-semibold, 600)", padding: "11px 16px" }}
            >
              Reload SketchDraw
            </button>
            <details style={{ "margin-top": "28px", color: "var(--theme-text-secondary)" }}>
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
