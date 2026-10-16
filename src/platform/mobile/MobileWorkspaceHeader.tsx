import type { JSX } from "solid-js";

type Props = {
  brandName: string;
  hasFile: boolean;
  readOnly: boolean;
  planning: boolean;
  headerRef: (element: HTMLElement) => void;
  commands: JSX.Element;
  workspaceTabs: JSX.Element;
  pageMenu: JSX.Element;
  status: JSX.Element;
};

/** Full touch header layout. It owns mobile navigation, page controls and the command popover. */
export function MobileWorkspaceHeader(props: Props) {
  return <header
    class="mobile-workspace-header"
    classList={{ "mobile-header-home": !props.hasFile, "mobile-header-planning": props.hasFile && props.planning, "mobile-header-canvas": props.hasFile && !props.planning }}
    ref={props.headerRef}
  >
    <div class="mobile-header-leading">
      <div class="mobile-brand" title={props.brandName}>
        <span>{props.brandName}</span>
      </div>
      {props.readOnly && <span class="mobile-view-only-badge">VIEW ONLY</span>}
    </div>
    {props.commands}
    {props.pageMenu}
    {props.workspaceTabs}
    {props.status}
  </header>;
}
