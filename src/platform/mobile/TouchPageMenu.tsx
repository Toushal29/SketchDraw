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

export function TouchPageMenu(props: Props) {
  let panel: HTMLDetailsElement | undefined;
  let actions: HTMLDetailsElement | undefined;
  const activeIndex = () => props.pages.findIndex(page => page.id === props.activePageId);
  const activePage = () => props.pages[activeIndex()];
  const closePanel = () => { if (panel) panel.open = false; if (actions) actions.open = false; };

  return <details class="touch-page-control" ref={element => { panel = element; }}>
    <summary aria-label={`Pages, current page ${activeIndex() + 1} of ${props.pages.length}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 2H4v13a2 2 0 0 0 2 2h13M9 8h7M9 12h7"/></svg>
      <span class="touch-page-current">{activePage()?.name ?? "Pages"}</span>
      <small>{Math.max(1, activeIndex() + 1)}/{props.pages.length}</small>
    </summary>
    <div class="touch-pages-popover">
      <header><strong>Pages</strong><button class="touch-page-add" disabled={props.boardLocked || props.pages.length >= 100} onClick={() => { closePanel(); props.onAddPage(); }}><span aria-hidden="true">+</span> New</button></header>
      <div class="touch-page-list" role="listbox" aria-label="Sketch pages">
        {props.pages.map((page, index) => <button class={`touch-page-option ${page.id === props.activePageId ? "active" : ""}`} role="option" aria-selected={page.id === props.activePageId} onClick={() => { closePanel(); props.onSelectPage(page.id); }}><small>{index + 1}</small><span>{page.name}</span>{page.id === props.activePageId && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>}</button>)}
      </div>
      <footer>
        <button class="touch-page-rename" disabled={props.boardLocked} onClick={() => { closePanel(); props.onRenamePage(); }}>Rename</button>
        <details class="touch-page-more" ref={element => { actions = element; }}>
          <summary>More</summary>
          <div class="touch-page-more-menu">
            <button disabled={props.boardLocked || props.pages.length >= 100} onClick={() => { closePanel(); props.onDuplicatePage(); }}>Duplicate page</button>
            <button disabled={props.boardLocked || activeIndex() <= 0} onClick={() => { closePanel(); props.onReorderPage(-1); }}>Move page left</button>
            <button disabled={props.boardLocked || activeIndex() < 0 || activeIndex() >= props.pages.length - 1} onClick={() => { closePanel(); props.onReorderPage(1); }}>Move page right</button>
            <button disabled={props.boardLocked || props.pages.length <= 1} onClick={() => { closePanel(); props.onDeletePage(); }}>Delete page</button>
          </div>
        </details>
      </footer>
    </div>
  </details>;
}
