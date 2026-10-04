import type { SketchPage } from "../../model";

type Props = {
  pages: SketchPage[];
  activePageId: string;
  boardLocked: boolean;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onRenamePage: () => void;
  onDuplicatePage: () => void;
  onReorderPage: (direction: -1 | 1) => void;
  onDeletePage: () => void;
};

export function DesktopPageTabs(props: Props) {
  return <nav class="page-tabs desktop-page-tabs" aria-label="Sketch pages">
    <div class="page-tab-list">{props.pages.map((page, index) => <button class={`page-tab ${page.id === props.activePageId ? "active" : ""}`} aria-current={page.id === props.activePageId ? "page" : undefined} title={`${page.name} — double-click to rename`} onClick={() => props.onSelectPage(page.id)} onDblClick={() => { props.onSelectPage(page.id); props.onRenamePage(); }}><small>{index + 1}</small> {page.name}</button>)}</div>
    <button title="Add page" aria-label="Add page" disabled={props.boardLocked || props.pages.length >= 100} onClick={props.onAddPage}>+</button>
    <details class="page-menu"><summary aria-label="Page actions">•••</summary><div class="page-actions" onClick={event => { (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
      <button disabled={props.boardLocked} onClick={props.onRenamePage}>Rename page</button>
      <button disabled={props.boardLocked || props.pages.length >= 100} onClick={props.onDuplicatePage}>Duplicate page</button>
      <button disabled={props.boardLocked || props.pages[0]?.id === props.activePageId} onClick={() => props.onReorderPage(-1)}>Move page left</button>
      <button disabled={props.boardLocked || props.pages[props.pages.length - 1]?.id === props.activePageId} onClick={() => props.onReorderPage(1)}>Move page right</button>
      <button disabled={props.boardLocked || props.pages.length <= 1} onClick={props.onDeletePage}>Delete page…</button>
    </div></details>
  </nav>;
}
