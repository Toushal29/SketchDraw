import { For } from "solid-js";

type Props = { paths: string[]; activePath?: string; displayName: (path: string) => string; onSelect: (path: string) => void; onClose: (path: string) => void };

export function DocumentTabs(props: Props) {
  return <nav class="windows-document-tabs" aria-label="Open sketches"><For each={props.paths}>{path => <div class="windows-document-tab" classList={{ active: path === props.activePath }}>
    <button type="button" class="windows-document-tab-name" aria-current={path === props.activePath ? "page" : undefined} title={path} onClick={() => props.onSelect(path)}>{props.displayName(path)}</button>
    <button type="button" class="windows-document-tab-close" title={`Close ${props.displayName(path)}`} aria-label={`Close ${props.displayName(path)}`} onClick={() => props.onClose(path)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg></button>
  </div>}</For></nav>;
}
