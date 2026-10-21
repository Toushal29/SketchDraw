import type { JSX } from "solid-js";

type Props = {
  label: string;
  children: JSX.Element;
};

export function DialogInfoTip(props: Props) {
  return <details class="dialog-info-tip">
    <summary aria-label={props.label} title={props.label}>i</summary>
    <div class="dialog-info-content">{props.children}</div>
  </details>;
}
