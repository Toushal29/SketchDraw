import type { JSX } from "solid-js";

type Props = {
  children: JSX.Element;
  settings: JSX.Element;
};

/** Menu rail used by the Windows desktop header. Touch layouts use MobileCommandBar. */
export function WindowsMenuRail(props: Props) {
  return <div class="app-menu-rail"><div class="app-menu-items">{props.children}</div>{props.settings}</div>;
}
