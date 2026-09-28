import type { Element, FlowchartShape, GroupElement, NoteKind, ShapeElement, TextElement } from "./model";

const text = (x: number, y: number, value: string, color = "#303638", size = 14, family: TextElement["fontFamily"] = "sans", bold = false): TextElement => ({
  type: "text", x, y, text: value, color, fontSize: size, fontFamily: family, bold, textAlign: "left", listType: "none",
});

const rect = (x: number, y: number, w: number, h: number, fill: string, color: string, radius = 12): ShapeElement => ({
  type: "rectangle", x, y, w, h, color, thickness: 1.4, fillColor: fill, fillOpacity: 1, edgeStyle: "rounded", cornerRadius: radius,
});

export const normalizeNoteContent = (content: string, kind: NoteKind) => {
  const hasContent = content.trim();
  if (kind !== "checklist") return content;
  return (hasContent ? content.split(/\r?\n/) : [""]).map(line => {
    if (!line.trim()) return "";
    const indent = /^\s*/.exec(line)?.[0].replace(/\t/g, "  ") ?? "";
    const task = line.trimStart();
    const existing = /^(?:(?:[-*]|\d+\.)\s+)?\[([ xX])\]\s*(.*)$/.exec(task);
    return existing ? `${indent}- [${existing[1]}] ${existing[2]}` : `${indent}- [ ] ${task.replace(/^(?:[-*]|\d+\.)\s+/, "")}`;
  }).filter(Boolean).join("\n") || "- [ ] New task";
};

function checklistRows(content: string, width: number, fontSize: number) {
  let top = 48;
  return content.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    const match = /^\s*(?:[-*]|\d+\.)\s+\[([ xX])\]\s*(.*)$/.exec(line);
    const indent = Math.min(6, Math.floor((line.match(/^\s*/)?.[0].length ?? 0) / 2)) * 12;
    const lineHeight = Math.max(16, fontSize * 1.3);
    const max = Math.max(8, Math.floor((width - 16 - indent - 48) / (fontSize * .52)));
    let rest = match?.[2] || "Untitled task"; const labelLines: string[] = [];
    while (rest.length > max) {
      const breakAt = rest.lastIndexOf(" ", max); const count = breakAt > 0 ? breakAt : max;
      labelLines.push(rest.slice(0, count)); rest = rest.slice(count).trimStart();
    }
    labelLines.push(rest);
    const height = Math.max(29, labelLines.length * lineHeight + 10);
    const row = { index, top, height, lineHeight, x: 16 + indent, done: match?.[1].toLowerCase() === "x", labelLines };
    top += height;
    return row;
  });
}

function syntaxTokens(line: string, language: string): { value: string; color: string }[] {
  const langs = language.toLowerCase();
  const generalKeywords = /\b(const|let|var|function|return|if|else|for|while|class|new|import|from|export|default|async|await|throw|try|catch|interface|type|public|private|static|def|elif|in|and|or|not|True|False|None|pass|with|as|yield|extends|implements|void|number|string|boolean|true|false|null)\b/g;
  const sqlKeywords = /\b(select|from|where|join|left|right|inner|outer|on|as|group|by|order|limit|create|table|insert|into|values|update|set|delete|primary|key|foreign|references|not|null|unique|and|or|count|having|distinct)\b/g;
  const cssKeywords = /\b(color|background|display|position|flex|grid|margin|padding|width|height|border|font|align|justify|gap|transform|opacity|overflow|top|right|bottom|left)\b/g;
  const isHtml = ["html", "xml", "svg", "jsx", "tsx"].includes(langs);
  const tokenPattern = isHtml
    ? /(<!--.*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g
    : /(\/\/.*|#.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;
  const tokens: { value: string; color: string }[] = [];
  let cursor = 0;
  for (const match of line.matchAll(tokenPattern)) {
    const value = match[0]; const start = match.index ?? 0;
    if (start > cursor) tokens.push({ value: line.slice(cursor, start), color: "#dce5f4" });
    let color = "#dce5f4";
    if (value.startsWith("//") || value.startsWith("#") || value.startsWith("<!--")) color = "#91a78d";
    else if (isHtml && value.startsWith("<")) color = "#85b8ee";
    else if (/^["'`]/.test(value)) color = langs === "json" ? "#a9d887" : "#e7b579";
    else if (/^\d/.test(value)) color = "#c5a6ed";
    else if (new RegExp((langs === "sql" ? sqlKeywords : ["css", "scss", "less"].includes(langs) ? cssKeywords : generalKeywords).source).test(value)) color = "#85b8ee";
    else if (/^[A-Z]/.test(value)) color = "#dfc477";
    tokens.push({ value, color }); cursor = start + value.length;
  }
  if (cursor < line.length) tokens.push({ value: line.slice(cursor), color: "#dce5f4" });
  return tokens.filter(token => token.value).reduce((runs, token) => {
    const previous = runs[runs.length - 1];
    if (previous?.color === token.color) previous.value += token.value;
    else runs.push({ ...token });
    return runs;
  }, [] as { value: string; color: string }[]);
}

/** Make a note out of ordinary v6 shapes and text, with its source kept as optional group metadata. */
export function buildNoteGroup(x: number, y: number, kind: NoteKind, source: string, dimensions: { width?: number; height?: number; fontSize?: number; collapsed?: boolean } = {}): GroupElement {
  const content = normalizeNoteContent(source, kind);
  const children: Element[] = [];
  const width = Math.max(180, Math.min(4000, dimensions.width ?? (kind === "sticky" ? 296 : 340)));
  const fontSize = Math.round(Math.max(8, Math.min(32, dimensions.fontSize ?? 14)));
  const left = x + 16; let cursorY = y + (kind === "checklist" ? 18 : 48);
  const lines = content.split(/\r?\n/);
  const collapsed = dimensions.collapsed === true;
  const background = kind === "sticky" ? "#fff1a8" : kind === "checklist" ? "#f3f8f3" : "#edf3fb";
  const border = kind === "sticky" ? "#e0cc73" : kind === "checklist" ? "#d5e2d6" : "#c8d7eb";
  const title = kind === "sticky" ? "STICKY NOTE" : kind === "checklist" ? "CHECKLIST" : "NOTE + CODE";
  const toggleX = x + width - 31; const toggleY = y + 10;
  const addToggle = () => {
    children.push(rect(toggleX, toggleY, 20, 20, kind === "sticky" ? "#fff8d7" : "#ffffff", border, 7));
    const midX = toggleX + 10; const midY = toggleY + 10;
    if (collapsed) {
      children.push({ type: "line", x: midX - 2, y: midY - 4, w: 4, h: 4, color: kind === "sticky" ? "#766628" : "#65788b", thickness: 1.7 }, { type: "line", x: midX + 2, y: midY, w: -4, h: 4, color: kind === "sticky" ? "#766628" : "#65788b", thickness: 1.7 });
    } else {
      children.push({ type: "line", x: midX - 4, y: midY - 2, w: 4, h: 4, color: kind === "sticky" ? "#766628" : "#65788b", thickness: 1.7 }, { type: "line", x: midX, y: midY + 2, w: 4, h: -4, color: kind === "sticky" ? "#766628" : "#65788b", thickness: 1.7 });
    }
  };
  if (collapsed) {
    const height = 54;
    const taskCount = lines.filter(line => line.trim()).length;
    children.push(rect(x, y, width, height, background, border, 14));
    children.push(text(left, y + 10, kind === "checklist" ? `${title} · ${taskCount} ITEMS` : title, kind === "sticky" ? "#837539" : kind === "checklist" ? "#718575" : "#718094", 9, "mono", true));
    if (kind !== "checklist") {
      const preview = lines.find(line => line.trim() && !/^\s*```/.test(line))?.replace(/^#{1,3}\s+/, "").trim() ?? "Empty note";
      const max = Math.max(8, Math.floor((width - 58) / 7.4));
      children.push(text(left, y + 29, preview.slice(0, max) + (preview.length > max ? "…" : ""), kind === "sticky" ? "#514724" : "#303d4c", 12, "sans"));
    }
    addToggle();
    return { type: "group", note: { kind, content, width, height: Math.max(100, dimensions.height ?? 100), fontSize, collapsed: true }, elements: children };
  }
  children.push(text(left, y + 13, title, kind === "sticky" ? "#837539" : kind === "checklist" ? "#718575" : "#718094", 9, "mono", true));
  addToggle();
  if (kind !== "checklist") children.push(rect(x + 12, y + 36, width - 24, 1, kind === "sticky" ? "#e6d99a" : "#dbe4ef", kind === "sticky" ? "#e6d99a" : "#dbe4ef", 1));
  if (kind === "checklist") {
    const taskRows = checklistRows(content, width, fontSize);
    const completed = taskRows.filter(row => row.done).length;
    children.push(text(x + width - 100, cursorY, `${completed}/${taskRows.length} done`, "#718575", 10, "sans", true));
    children.push(rect(left, cursorY + 18, width - 32, 4, "#d5e2d6", "#d5e2d6", 2));
    if (completed) children.push(rect(left, cursorY + 18, (width - 32) * completed / taskRows.length, 4, "#75a883", "#75a883", 2));
    cursorY += 30;
    taskRows.forEach(row => {
      const taskX = x + row.x; const taskY = y + row.top;
      const checkY = taskY + Math.max(1, (row.height - 17) / 2);
      children.push(rect(taskX, checkY, 17, 17, row.done ? "#75a883" : "#ffffff", row.done ? "#75a883" : "#8b9d8f", 4));
      if (row.done) children.push(text(taskX + 2, checkY - 2, "\u2713", "#ffffff", 15, "sans", true));
      row.labelLines.forEach((line, index) => children.push(text(taskX + 28, taskY + index * row.lineHeight, line, row.done ? "#89958b" : "#33423a", fontSize, "sans", false)));
      cursorY = Math.max(cursorY, taskY + row.height);
    });
  } else {
    let inCode = false; let codeLanguage = "text"; let codeLines: string[] = [];
    const flushCode = () => {
      if (!inCode) return;
      const codeFontSize = fontSize; const characterWidth = codeFontSize * .65;
      const wrapped = codeLines.flatMap(line => { const max = Math.max(12, Math.floor((width - 42) / characterWidth)); if (!line) return [""]; return Array.from({ length: Math.ceil(line.length / max) }, (_, i) => line.slice(i * max, (i + 1) * max)); });
      const lineHeight = codeFontSize * 1.55;
      const blockHeight = Math.max(48, wrapped.length * lineHeight + codeFontSize * 1.9);
      children.push(rect(x + 9, cursorY, width - 18, blockHeight, "#202936", "#354355", 9));
      children.push(text(left + 3, cursorY + 7, codeLanguage.toUpperCase(), "#92a2b6", 9, "mono", true));
      wrapped.forEach((line, index) => {
        let column = 0;
        for (const token of syntaxTokens(line, codeLanguage)) {
          children.push(text(left + 3 + column * characterWidth, cursorY + codeFontSize * 1.9 + index * lineHeight, token.value, token.color, codeFontSize, "mono"));
          column += token.value.length;
        }
      });
      cursorY += blockHeight + 9; codeLines = []; inCode = false;
    };
    for (const line of lines) {
      const fence = /^\s*```\s*([\w+#.-]*)\s*$/.exec(line);
      if (fence) { if (!inCode) { inCode = true; codeLanguage = fence[1] || "text"; } else flushCode(); continue; }
      if (inCode) { codeLines.push(line); continue; }
      if (!line.trim()) { cursorY += 9; continue; }
      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      const value = heading?.[2] ?? line;
      const size = heading ? fontSize + (4 - heading[1].length) * 2 : fontSize;
      const max = Math.max(8, Math.floor((width - 32) / (fontSize * (kind === "sticky" ? .52 : .56))));
      for (let offset = 0; offset < Math.max(1, value.length); offset += max) {
        children.push(text(left, cursorY, value.slice(offset, offset + max), kind === "sticky" ? "#514724" : "#303d4c", size, "sans", !!heading));
        cursorY += size * 1.55;
      }
    }
    if (inCode) flushCode();
  }
  const height = Math.max(100, cursorY - y + 17, dimensions.height ?? 0);
  return { type: "group", note: { kind, content, width, height, fontSize, collapsed: false }, elements: [rect(x, y, width, height, background, border, 14), ...children] };
}

export function noteCollapseHit(group: GroupElement, point: { x: number; y: number }): boolean {
  if (!group.note) return false;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return false;
  const x = background.x + background.w - 31; const y = background.y + 10;
  return point.x >= x && point.x <= x + 20 && point.y >= y && point.y <= y + 20;
}

export const EXTRA_FLOWCHART_SHAPES: { value: FlowchartShape; label: string }[] = [
  { value: "cloud", label: "Cloud / external service" }, { value: "star", label: "Star" },
  { value: "lightning", label: "Lightning" }, { value: "heart", label: "Heart" },
  { value: "callout", label: "Callout" }, { value: "gear", label: "Gear" },
];

export function checklistIndexAt(group: GroupElement, point: { x: number; y: number }): number | undefined {
  if (group.note?.kind !== "checklist" || group.note.collapsed) return undefined;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return undefined;
  for (const row of checklistRows(group.note.content, Math.abs(background.w), group.note.fontSize ?? 14)) {
    const x = background.x + row.x; const y = background.y + row.top + Math.max(1, (row.height - 17) / 2);
    if (point.x >= x - 2 && point.x <= x + 20 && point.y >= y - 2 && point.y <= y + 20) return row.index;
  }
  return undefined;
}

export function toggleChecklistContent(content: string, target: number): string {
  let row = -1;
  return content.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    row++;
    if (row !== target) return line;
    return line.replace(/\[([ xX])\]/, (_match, value: string) => `[${value.trim() ? " " : "x"}]`);
  }).join("\n");
}

export type LibraryComponentKind = "uml-class" | "uml-lifeline" | "uml-activation" | "uml-inheritance" | "uml-realization" | "uml-aggregation" | "uml-composition" | "sequence-sync" | "sequence-async" | "er-table" | "er-one-many" | "er-many-many" | "c4-system" | "c4-container" | "c4-component" | "tech-database" | "tech-cloud" | "tech-service" | "data-flow" | "network-zone";
export const LIBRARY_COMPONENTS: { kind: LibraryComponentKind; section: string; label: string; description: string; width: number; height: number }[] = [
  { kind: "uml-class", section: "UML · Class & sequence", label: "Class card", description: "Name, attributes, and methods compartments", width: 230, height: 154 },
  { kind: "uml-lifeline", section: "UML · Class & sequence", label: "Lifeline", description: "Participant header and dashed lifeline", width: 154, height: 250 },
  { kind: "uml-activation", section: "UML · Class & sequence", label: "Activation bar", description: "Sequence activation marker", width: 28, height: 82 },
  { kind: "sequence-sync", section: "UML · Class & sequence", label: "Sync message", description: "Solid synchronous message arrow", width: 184, height: 50 },
  { kind: "sequence-async", section: "UML · Class & sequence", label: "Async message", description: "Open asynchronous message arrow", width: 184, height: 50 },
  { kind: "uml-inheritance", section: "UML · Relationships", label: "Inheritance", description: "Solid line with hollow arrow", width: 184, height: 42 },
  { kind: "uml-realization", section: "UML · Relationships", label: "Realization", description: "Dashed line with hollow arrow", width: 184, height: 42 },
  { kind: "uml-aggregation", section: "UML · Relationships", label: "Aggregation", description: "Hollow diamond relationship", width: 184, height: 42 },
  { kind: "uml-composition", section: "UML · Relationships", label: "Composition", description: "Filled diamond relationship", width: 184, height: 42 },
  { kind: "er-table", section: "ER · Tables & relations", label: "Table schema card", description: "Table with PK, FK, field, and type rows", width: 220, height: 156 },
  { kind: "er-one-many", section: "ER · Tables & relations", label: "One to many", description: "Crow’s foot relationship connector", width: 190, height: 42 },
  { kind: "er-many-many", section: "ER · Tables & relations", label: "Many to many", description: "Crow’s feet on both endpoints", width: 190, height: 42 },
  { kind: "c4-system", section: "Architecture · C4 & infrastructure", label: "System boundary", description: "C4 system context enclosure", width: 300, height: 190 },
  { kind: "c4-container", section: "Architecture · C4 & infrastructure", label: "Container boundary", description: "C4 container enclosure", width: 250, height: 156 },
  { kind: "c4-component", section: "Architecture · C4 & infrastructure", label: "Component boundary", description: "C4 component enclosure", width: 210, height: 132 },
  { kind: "tech-database", section: "Architecture · C4 & infrastructure", label: "Database node", description: "Database with technology tag", width: 150, height: 94 },
  { kind: "tech-cloud", section: "Architecture · C4 & infrastructure", label: "External service", description: "Cloud service node", width: 166, height: 92 },
  { kind: "tech-service", section: "Architecture · C4 & infrastructure", label: "Service node", description: "Service with technology tag", width: 174, height: 92 },
  { kind: "data-flow", section: "Architecture · C4 & infrastructure", label: "Data flow", description: "Directional data pipeline arrow", width: 202, height: 46 },
  { kind: "network-zone", section: "Architecture · C4 & infrastructure", label: "Network zone", description: "Translucent infrastructure enclosure", width: 280, height: 168 },
];

const lineElement = (x: number, y: number, w: number, h: number, color = "#74889a", dashed = false): ShapeElement => ({ type: "line", x, y, w, h, color, thickness: 1.4, lineStyle: dashed ? "dashed" : "solid", startHead: "none", endHead: "none" });

export function buildLibraryComponent(kind: LibraryComponentKind, x: number, y: number): GroupElement {
  const elements: Element[] = [];
  if (kind === "uml-class") {
    elements.push(rect(x, y, 230, 154, "#f8fbff", "#7e94ad", 9), rect(x, y, 230, 36, "#e8f0fb", "#7e94ad", 9));
    elements.push(lineElement(x, y + 36, 230, 0), lineElement(x, y + 92, 230, 0));
    elements.push(text(x + 12, y + 9, "ClassName", "#345371", 14, "sans", true));
    elements.push(text(x + 12, y + 48, "+ id: UUID\n- name: string\n# state: Status", "#334453", 12, "mono"));
    elements.push(text(x + 12, y + 105, "+ create()\n- validate()", "#334453", 12, "mono"));
  } else if (kind === "uml-lifeline") {
    elements.push(rect(x + 12, y, 130, 42, "#edf4ff", "#7e94ad", 8), text(x + 24, y + 13, "Participant", "#345371", 13, "sans", true));
    elements.push(lineElement(x + 77, y + 42, 0, 200, "#8497a8", true));
  } else if (kind === "uml-activation") {
    elements.push(rect(x + 5, y, 18, 82, "#d7e6f8", "#6887a6", 3));
  } else if (kind.startsWith("uml-") && ["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition"].includes(kind)) {
    const dashed = kind === "uml-realization"; const relation = lineElement(x + 24, y + 21, 148, 0, "#657b91", dashed); relation.endHead = kind === "uml-inheritance" || dashed ? "open" : "none"; elements.push(relation);
    if (kind === "uml-aggregation" || kind === "uml-composition") elements.push({ type: "diamond", x: x + 9, y: y + 15, w: 12, h: 12, color: "#657b91", thickness: 1.4, fillColor: kind === "uml-composition" ? "#657b91" : "#ffffff" });
  } else if (kind === "sequence-sync" || kind === "sequence-async") {
    const message = lineElement(x + 5, y + 25, 174, 0, "#617a92"); message.endHead = kind === "sequence-async" ? "open" : "solid"; elements.push(message, text(x + 8, y + 3, kind === "sequence-async" ? "async message" : "sync message", "#617a92", 10));
  } else if (kind === "er-table") {
    elements.push(rect(x, y, 220, 156, "#fbfcfe", "#879caf", 9), rect(x, y, 220, 32, "#e8f0f7", "#879caf", 9));
    elements.push(text(x + 12, y + 9, "table_name", "#36556e", 13, "sans", true));
    elements.push(lineElement(x, y + 32, 220, 0), lineElement(x, y + 73, 220, 0), lineElement(x, y + 114, 220, 0));
    elements.push(text(x + 10, y + 43, "PK   id                   INT", "#536477", 11, "mono"), text(x + 10, y + 84, "FK   related_id      INT", "#536477", 11, "mono"), text(x + 10, y + 125, "     name          TEXT", "#536477", 11, "mono"));
  } else if (kind === "er-one-many" || kind === "er-many-many") {
    elements.push(lineElement(x + 8, y + 21, 174, 0, "#60788e"));
    const foot = (fx: number, fy: number, direction: number) => [lineElement(fx, fy, direction * 12, -10, "#60788e"), lineElement(fx, fy, direction * 12, 0, "#60788e"), lineElement(fx, fy, direction * 12, 10, "#60788e")];
    if (kind === "er-many-many") elements.push(...foot(x + 9, y + 21, 1), ...foot(x + 181, y + 21, -1));
    else { elements.push(lineElement(x + 174, y + 12, 0, 18, "#60788e"), ...foot(x + 182, y + 21, -1), text(x + 12, y + 3, "1", "#60788e", 10), text(x + 157, y + 3, "*", "#60788e", 11)); }
  } else if (kind === "c4-system" || kind === "c4-container" || kind === "c4-component") {
    const meta = LIBRARY_COMPONENTS.find(item => item.kind === kind)!; const title = kind === "c4-system" ? "System context" : kind === "c4-container" ? "Container boundary" : "Component boundary";
    elements.push({ ...rect(x, y, meta.width, meta.height, "#eef4ff", "#6884a0", 13), lineStyle: "dashed" }, text(x + 14, y + 12, title, "#496681", 13, "sans", true), text(x + 14, y + 34, "Drag nodes inside this boundary", "#73879a", 10));
  } else if (kind === "tech-database") {
    elements.push({ type: "flowchart", x, y, w: 150, h: 94, color: "#6f7997", thickness: 1.5, fillColor: "#f0edfb", flowchartShape: "database", label: { text: "Database\nPostgreSQL", color: "#535c78", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
  } else if (kind === "tech-cloud") {
    elements.push({ type: "flowchart", x, y, w: 166, h: 92, color: "#6685a1", thickness: 1.5, fillColor: "#edf5fb", flowchartShape: "cloud", label: { text: "External API\nHTTPS", color: "#48657f", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
  } else if (kind === "tech-service") {
    elements.push({ ...rect(x, y, 174, 92, "#edf5f0", "#759785", 11), label: { text: "Service\nDocker · Node.js", color: "#4c6a59", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
  } else if (kind === "data-flow") {
    const pipe: ShapeElement = { type: "arrow", x: x + 5, y: y + 24, w: 192, h: 0, color: "#2d83a4", thickness: 4, lineStyle: "dashed", startHead: "none", endHead: "solid" }; elements.push(pipe, text(x + 8, y + 2, "data stream / ETL", "#367991", 10));
  } else if (kind === "network-zone") {
    elements.push({ ...rect(x, y, 280, 168, "#daf0f1", "#68a2a3", 13), fillOpacity: .42, lineStyle: "dashed" }, text(x + 14, y + 12, "Private subnet / VPC", "#3d7477", 12, "sans", true));
  }
  return { type: "group", elements };
}
