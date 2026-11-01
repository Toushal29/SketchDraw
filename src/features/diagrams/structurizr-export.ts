import type { Element } from "../../model";

function flatten(elements: Element[]): Element[] { return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? flatten(item.elements) : [item]); }
function quote(value: string): string { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ")}"`; }

/** Export modeled Structurizr nodes and relationships, preserving their aliases. */
export function exportStructurizrDsl(elements: Element[]): string {
  const items = flatten(elements); const declarations: string[] = []; const relationships: string[] = [];
  for (const item of items) {
    if (!("componentRole" in item) || !item.componentRole) continue;
    if (item.componentRole.startsWith("structurizr-node|")) {
      if (item.type !== "rectangle" && item.type !== "circle" && item.type !== "diamond") continue;
      const [, kind, encodedAlias] = item.componentRole.split("|"); let alias = ""; try { alias = decodeURIComponent(encodedAlias); } catch { alias = encodedAlias; }
      const title = item.label?.text.split("\n")[0] ?? alias; const detail = item.label?.text.split("\n").slice(1) ?? []; const description = detail[0]?.startsWith("C4 ") ? detail.slice(1).join(" ") : detail.join(" ");
      declarations.push(`    ${alias} = ${kind} ${quote(title)}${description ? ` ${quote(description)}` : ""}`);
      continue;
    }
    if (!item.componentRole.startsWith("structurizr-edge|")) continue;
    if (item.type !== "line" && item.type !== "arrow") continue;
    const parts = item.componentRole.split("|"); if (parts.length < 3) continue;
    let from = ""; let to = ""; try { from = decodeURIComponent(parts[1]); to = decodeURIComponent(parts[2]); } catch { continue; }
    const label = item.label?.text.trim(); relationships.push(`    ${from} -> ${to}${label ? ` ${quote(label)}` : ""}`);
  }
  if (!declarations.length) throw new Error("Select or import a Structurizr diagram with supported model elements first.");
  return ["workspace \"SketchDraw\" {", "  model {", ...declarations, ...relationships, "  }", "}"].join("\n");
}
