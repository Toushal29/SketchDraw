import "./schema-code-editor.css";

type Props = {
  value: string;
  label: string;
  className: "schema-input" | "schema-side-input";
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  rows?: number;
  autofocus?: boolean;
  wrap?: boolean;
  onInput: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => void;
  onTextarea?: (element: HTMLTextAreaElement) => void;
};

/** A single-layer native textarea, so rendered text and the editable value cannot drift apart. */
export function SchemaCodeEditor(props: Props) {
  return <div class="schema-code-editor" classList={{
    "schema-code-editor-side": props.className === "schema-side-input",
    "schema-code-editor-dialog": props.className === "schema-input",
    "schema-code-editor-no-wrap": props.wrap === false,
  }}>
    <textarea
      ref={props.onTextarea}
      class={`schema-code-textarea ${props.className}`}
      aria-label={props.label}
      aria-invalid={props.invalid}
      spellcheck={false}
      wrap={props.wrap === false ? "off" : "soft"}
      rows={props.rows ?? 12}
      autofocus={props.autofocus}
      disabled={props.disabled}
      value={props.value}
      placeholder={props.placeholder}
      onInput={event => props.onInput(event.currentTarget.value)}
      onBlur={() => props.onBlur?.()}
      onKeyDown={event => props.onKeyDown?.(event)}
    />
  </div>;
}
