import type { JSX } from "solid-js";

type Props = {
  children: JSX.Element;
  settings: JSX.Element;
};

/** Dedicated touch menu surface; display:contents keeps the desktop menu row intact. */
export function TouchMenuBar(props: Props) {
  return (
    <div class="touch-menu-bar app-menu-rail">
      <div class="touch-menu-items app-menu-items">{props.children}</div>
      {props.settings}
    </div>
  );
}
