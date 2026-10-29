import type { ArrowHead } from "../model";

export function ArrowHeadIcon(props: { kind: ArrowHead }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h12" />{props.kind === "open" && <path d="m12 7 5 5-5 5" />}{props.kind === "solid" && <path d="m12 7 6 5-6 5z" fill="currentColor" />}{props.kind === "hollow" && <path d="M17 12 10 6v12z" />}{props.kind === "thick" && <path d="m10 5 9 7-9 7z" fill="currentColor" />}{props.kind === "dot" && <circle cx="17" cy="12" r="3" fill="currentColor" />}{props.kind === "diamond" && <path d="m17 7 5 5-5 5-5-5z" fill="currentColor" />}{props.kind === "open-diamond" && <path d="M17 12 11 6 5 12l6 6z" />}{props.kind === "bar" && <path d="M17 6v12" />}{props.kind === "crow" && <path d="m17 6-5 6 5 6m0-12-5 6" />}</svg>;
}
