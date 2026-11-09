import type { JSX } from "solid-js";
import "./inspector.css";

export type InspectorTab = "design" | "prototype" | "inspect";

type InspectorPanelProps = {
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  design: JSX.Element;
  prototype: JSX.Element;
  inspect: JSX.Element;
};

const tabs: Array<{ id: InspectorTab; label: string; hint: string }> = [
  { id: "design", label: "Design", hint: "Edit selected layer properties" },
  { id: "prototype", label: "Prototype", hint: "Edit prototype flows and interactions" },
  { id: "inspect", label: "Inspect", hint: "Inspect and export design details" },
];

export function InspectorPanel(props: InspectorPanelProps) {
  const handleTabKeyDown: JSX.EventHandler<HTMLButtonElement, KeyboardEvent> = event => {
    const currentIndex = tabs.findIndex(tab => tab.id === props.activeTab);
    const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length : event.key === "ArrowLeft" ? (currentIndex + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    props.onTabChange(tabs[nextIndex].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[nextIndex]?.focus();
  };

  return <aside class="ui-right-panel sdui-inspector" aria-label="Design properties">
    <nav class="sdui-inspector-tabs" role="tablist" aria-label="Inspector panels">
      {tabs.map(tab => <button type="button" role="tab" id={`sdui-inspector-tab-${tab.id}`} aria-controls={`sdui-inspector-panel-${tab.id}`} aria-selected={props.activeTab === tab.id} tabIndex={props.activeTab === tab.id ? 0 : -1} class={props.activeTab === tab.id ? "is-active" : ""} title={tab.hint} onKeyDown={handleTabKeyDown} onClick={() => props.onTabChange(tab.id)}>{tab.label}</button>)}
    </nav>
    <div class="sdui-inspector-content">
      <section class="sdui-inspector-tab-panel" role="tabpanel" id="sdui-inspector-panel-design" aria-labelledby="sdui-inspector-tab-design" hidden={props.activeTab !== "design"}>
        {props.design}
      </section>
      <section class="sdui-inspector-tab-panel" role="tabpanel" id="sdui-inspector-panel-prototype" aria-labelledby="sdui-inspector-tab-prototype" hidden={props.activeTab !== "prototype"}>
        {props.prototype}
      </section>
      <section class="sdui-inspector-tab-panel" role="tabpanel" id="sdui-inspector-panel-inspect" aria-labelledby="sdui-inspector-tab-inspect" hidden={props.activeTab !== "inspect"}>
        {props.inspect}
      </section>
    </div>
  </aside>;
}
