import type { Element, Point, ShapeElement, TextElement } from "../../model";
import { elementBounds, unionBounds } from "../canvas/bounds";
import { flatten } from "../../operations";
import { createStoredZip } from "../files/zip";
import { unzipVsdxArchiveInWorker } from "./visio-vsdx-archive-client";

const MAX_SHAPES = 20_000;
const UNITS_PER_INCH = 96;
const xml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const safeColor = (value: string | undefined, fallback: string) => /^#[\da-f]{6}$/i.test(value ?? "") ? value! : fallback;
const directCell = (node: globalThis.Element, name: string) => [...node.children].find(child => child.localName === "Cell" && child.getAttribute("N") === name)?.getAttribute("V") ?? undefined;
const sectionCell = (node: globalThis.Element, sectionName: string, cellName: string) => {
  const section = [...node.children].find(child => child.localName === "Section" && child.getAttribute("N") === sectionName);
  const row = section && [...section.children].find(child => child.localName === "Row");
  return (row && [...row.children].find(child => child.localName === "Cell" && child.getAttribute("N") === cellName)?.getAttribute("V")) ?? undefined;
};
const cellNumber = (node: globalThis.Element, name: string, fallback = 0) => {
  const raw = directCell(node, name); const value = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
};
const xmlDocument = (source: string) => {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("The Visio package contains a document type declaration that SketchDraw will not load.");
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("A Visio XML document is malformed.");
  return document;
};

function readEntry(entries: Map<string, Uint8Array>, path: string) {
  const bytes = entries.get(path);
  return bytes ? new TextDecoder().decode(bytes) : undefined;
}

const flowchartNames: Record<string, NonNullable<ShapeElement["flowchartShape"]>> = {
  Process: "process", Terminator: "terminator", Decision: "decision", Data: "data", Document: "document", "Multi-Document": "multi-document", Database: "database", "Predefined Process": "predefined-process", Preparation: "preparation", ManualInput: "manual-input", "Manual Input": "manual-input", "Manual Operation": "manual-operation", Connector: "connector", "Off-page Reference": "off-page", Delay: "delay", StoredData: "stored-data", Display: "display", Merge: "merge", Extract: "extract", Collate: "collate", Sort: "sort", Cloud: "cloud",
};
const flowchartNameByKind: Partial<Record<NonNullable<ShapeElement["flowchartShape"]>, string>> = Object.fromEntries(Object.entries(flowchartNames).map(([name, kind]) => [kind, name]));

function visioShapeName(element: ShapeElement): string {
  if (element.type === "rectangle") return "Rectangle";
  if (element.type === "circle") return "Ellipse";
  if (element.type === "diamond") return "Diamond";
  if (element.type === "triangle") return "Triangle";
  if (element.type === "flowchart") return flowchartNameByKind[element.flowchartShape ?? "process"] ?? "Rectangle";
  return "Rectangle";
}

function elementLabel(item: Element): string {
  if (item.type === "group") return "";
  if (item.type === "text") return item.text;
  if (item.type === "schemaTable") return [item.name, ...item.columns.map(column => `${column.primaryKey ? "◆ " : ""}${column.name}: ${column.dataType}`)].join("\n");
  if (item.type === "image") return `Image${item.altText ? `: ${item.altText}` : " (embedded image omitted in VSDX export)"}`;
  if (item.type === "freehand") return "";
  if (item.type === "svgPath") return item.altText || "Vector path simplified to a box in VSDX export";
  return item.label?.text ?? "";
}

function shapeXml(item: Element, id: number, origin: Point, pageHeight: number, idsByElementId: Map<string, number>) {
  const bounds = elementBounds(item); const x = (bounds.x - origin.x) / UNITS_PER_INCH; const y = pageHeight - (bounds.y - origin.y + bounds.h) / UNITS_PER_INCH;
  const width = Math.max(0.01, bounds.w / UNITS_PER_INCH); const height = Math.max(0.01, bounds.h / UNITS_PER_INCH);
  const cx = x + width / 2; const cy = y + height / 2;
  const stroke = safeColor("color" in item ? item.color : undefined, "#34495E");
  const fill = "fillColor" in item ? safeColor(item.fillColor, "#FFFFFF") : "#FFFFFF";
  const thickness = "thickness" in item ? Math.max(0.5, Math.min(24, item.thickness)) / UNITS_PER_INCH : 1.5 / UNITS_PER_INCH;
  const label = elementLabel(item);
  if (item.type === "line" || item.type === "arrow") {
    const start = { x: (item.x - origin.x) / UNITS_PER_INCH, y: pageHeight - (item.y - origin.y) / UNITS_PER_INCH };
    const end = { x: (item.x + item.w - origin.x) / UNITS_PER_INCH, y: pageHeight - (item.y + item.h - origin.y) / UNITS_PER_INCH };
    const begin = item.startBinding ? idsByElementId.get(item.startBinding.elementId) : undefined;
    const finish = item.endBinding ? idsByElementId.get(item.endBinding.elementId) : undefined;
    const beginArrow = item.startHead && item.startHead !== "none" ? 1 : 0; const endArrow = (item.endHead ?? (item.type === "arrow" ? "solid" : "none")) !== "none" ? 13 : 0;
    return { xml: `<Shape ID="${id}" NameU="Dynamic connector" Name="Connector ${id}" Type="Shape"><Cell N="OneD" V="1"/><Cell N="BeginX" V="${start.x}"/><Cell N="BeginY" V="${start.y}"/><Cell N="EndX" V="${end.x}"/><Cell N="EndY" V="${end.y}"/><Cell N="LineColor" V="${stroke}"/><Cell N="LineWeight" V="${thickness}"/><Cell N="LinePattern" V="${item.lineStyle === "dashed" ? 2 : item.lineStyle === "dotted" ? 3 : 1}"/><Cell N="BeginArrow" V="${beginArrow}"/><Cell N="EndArrow" V="${endArrow}"/><Section N="Geometry" IX="0"><Cell N="NoFill" V="1"/><Cell N="NoLine" V="0"/><Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row><Row T="LineTo" IX="2"><Cell N="X" V="${end.x - start.x}"/><Cell N="Y" V="${end.y - start.y}"/></Row></Section>${label ? `<Text>${xml(label)}</Text>` : ""}</Shape>`, connects: [{ from: "BeginX", target: begin }, { from: "BeginY", target: begin }, { from: "EndX", target: finish }, { from: "EndY", target: finish }].filter(connect => connect.target).map(connect => `<Connect FromSheet="${id}" FromCell="${connect.from}" ToSheet="${connect.target}" ToCell="PinX"/>`) };
  }
  const name = item.type === "schemaTable" ? "Rectangle" : item.type === "freehand" ? "Freeform" : item.type === "svgPath" ? "Rectangle" : item.type === "text" ? "Text" : item.type === "image" ? "Rectangle" : item.type === "group" ? "Rectangle" : visioShapeName(item);
  const noFill = item.type === "text" || item.type === "freehand" || item.type === "svgPath" || item.type === "image" || item.type === "schemaTable" || "fillColor" in item && !item.fillColor;
  const fontSize = item.type === "text" ? item.fontSize : item.type === "schemaTable" ? item.fontSize ?? 12 : item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" ? item.label?.fontSize ?? 14 : 14;
  const textColor = item.type === "text" ? safeColor(item.color, "#111827") : item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" ? safeColor(item.label?.color, "#111827") : "#111827";
  let geometry = "";
  if (item.type === "freehand") {
    const points = item.points;
    const first = points[0]; const rows = points.slice(1).map((point, index) => `<Row T="LineTo" IX="${index + 2}"><Cell N="X" V="${(point.x - bounds.x) / UNITS_PER_INCH}"/><Cell N="Y" V="${(bounds.y + bounds.h - point.y) / UNITS_PER_INCH}"/></Row>`).join("");
    geometry = `<Section N="Geometry" IX="0"><Cell N="NoFill" V="1"/><Cell N="NoLine" V="0"/><Row T="MoveTo" IX="1"><Cell N="X" V="${(first.x - bounds.x) / UNITS_PER_INCH}"/><Cell N="Y" V="${(bounds.y + bounds.h - first.y) / UNITS_PER_INCH}"/></Row>${rows}</Section>`;
  }
  const linePattern = item.type === "text" ? 0 : "lineStyle" in item && item.lineStyle === "dashed" ? 2 : "lineStyle" in item && item.lineStyle === "dotted" ? 3 : 1;
  return { xml: `<Shape ID="${id}" NameU="${xml(name)}" Name="${xml(name)}.${id}" Type="Shape"><Cell N="PinX" V="${cx}"/><Cell N="PinY" V="${cy}"/><Cell N="Width" V="${width}"/><Cell N="Height" V="${height}"/><Cell N="LocPinX" V="${width / 2}"/><Cell N="LocPinY" V="${height / 2}"/><Cell N="LineColor" V="${stroke}"/><Cell N="LineWeight" V="${thickness}"/><Cell N="LinePattern" V="${linePattern}"/><Cell N="FillForegnd" V="${fill}"/><Cell N="FillPattern" V="${noFill ? 0 : 1}"/><Section N="Character" IX="0"><Row IX="0"><Cell N="Size" V="${fontSize / 72}"/><Cell N="Color" V="${textColor}"/></Row></Section>${geometry}${label ? `<Text>${xml(label)}</Text>` : ""}</Shape>`, connects: [] };
}

/** Export editable Visio shapes, text, connector endpoints, and basic ink as a local VSDX package. */
export function exportVsdx(source: Element[]): Uint8Array {
  const elements = flatten(source).filter(item => !item.hidden && item.type !== "group");
  if (!elements.length) throw new Error("Add at least one visible object before exporting a Visio diagram.");
  if (elements.length > MAX_SHAPES) throw new Error("VSDX export is limited to 20,000 visible objects.");
  const bounds = unionBounds(elements.map(elementBounds)) ?? { x: 0, y: 0, w: 500, h: 400 };
  const margin = 24; const origin = { x: bounds.x - margin, y: bounds.y - margin };
  const pageWidth = Math.max(1, (bounds.w + margin * 2) / UNITS_PER_INCH); const pageHeight = Math.max(1, (bounds.h + margin * 2) / UNITS_PER_INCH);
  const idsByElementId = new Map<string, number>(); let nextId = 2;
  for (const item of elements) if (item.id) idsByElementId.set(item.id, nextId++);
  const shapes = elements.map(item => shapeXml(item, item.id ? idsByElementId.get(item.id)! : nextId++, origin, pageHeight, idsByElementId));
  const shapeXmlText = shapes.map(shape => shape.xml).join(""); const connectXmlText = shapes.flatMap(shape => shape.connects).join("");
  const files = [
    { path: "[Content_Types].xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/><Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/><Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/></Types>` },
    { path: "_rels/.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/office/visio/2010/relationships/document" Target="visio/document.xml"/></Relationships>` },
    { path: "visio/document.xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><VisioDocument xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><DocumentSettings/><Pages r:id="rId1"/></VisioDocument>` },
    { path: "visio/_rels/document.xml.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/office/visio/2010/relationships/pages" Target="pages/pages.xml"/></Relationships>` },
    { path: "visio/pages/pages.xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><Page ID="0" Name="Page-1" NameU="Page-1" IsCustomName="1" IsCustomNameU="1"><PageSheet><Cell N="PageWidth" V="${pageWidth}"/><Cell N="PageHeight" V="${pageHeight}"/></PageSheet><Rel r:id="rId1"/></Page></Pages>` },
    { path: "visio/pages/_rels/pages.xml.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/office/visio/2010/relationships/page" Target="page1.xml"/></Relationships>` },
    { path: "visio/pages/page1.xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main"><Shapes>${shapeXmlText}</Shapes><Connects>${connectXmlText}</Connects></PageContents>` },
  ];
  return createStoredZip(files, 32_000_000, "Visio package");
}

function relationshipTargets(source: string | undefined) {
  if (!source) return new Map<string, string>();
  const document = xmlDocument(source); const targets = new Map<string, string>();
  for (const relation of document.getElementsByTagName("Relationship")) {
    const id = relation.getAttribute("Id"); const target = relation.getAttribute("Target");
    if (id && target && !target.startsWith("/") && !target.split(/[\\/]/).includes("..")) targets.set(id, target.replace(/\\/g, "/"));
  }
  return targets;
}

function resolvePart(base: string, target: string) {
  const parts = [...base.split("/").slice(0, -1), ...target.split("/")]; const normalized: string[] = [];
  for (const part of parts) { if (!part || part === ".") continue; if (part === "..") normalized.pop(); else normalized.push(part); }
  return normalized.join("/");
}

function pageDimension(document: Document, name: string, fallback: number) {
  const cells = [...document.getElementsByTagName("Cell")]; const raw = cells.find(cell => cell.getAttribute("N") === name)?.getAttribute("V"); const value = Number.parseFloat(raw ?? "");
  return Number.isFinite(value) && value > 0 && value < 100_000 ? value : fallback;
}

function elementAnchor(item: ShapeElement, target: Point): Point {
  const bounds = elementBounds(item); const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
  if (bounds.w <= 0 || bounds.h <= 0) return { x: 0.5, y: 0.5 };
  const dx = target.x - cx; const dy = target.y - cy;
  if (Math.abs(dx / bounds.w) >= Math.abs(dy / bounds.h)) return { x: dx >= 0 ? 1 : 0, y: 0.5 };
  return { x: 0.5, y: dy >= 0 ? 1 : 0 };
}

/** Import the first VSDX page as editable SketchDraw primitives. */
export async function importVsdx(archive: Uint8Array): Promise<Element[]> {
  const entries = await unzipVsdxArchiveInWorker(archive);
  const pagesXml = readEntry(entries, "visio/pages/pages.xml");
  if (!pagesXml) throw new Error("This package does not contain Visio pages.");
  const pagesDocument = xmlDocument(pagesXml); const page = pagesDocument.getElementsByTagName("Page")[0];
  if (!page) throw new Error("The Visio document does not contain a page.");
  const pageRelId = page.getAttribute("r:id") ?? page.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const rels = relationshipTargets(readEntry(entries, "visio/pages/_rels/pages.xml.rels"));
  const pageTarget = pageRelId ? rels.get(pageRelId) : undefined;
  const pagePath = pageTarget ? resolvePart("visio/pages/pages.xml", pageTarget) : "visio/pages/page1.xml";
  const pageSource = readEntry(entries, pagePath);
  if (!pageSource) throw new Error("The first Visio page content could not be found.");
  const document = xmlDocument(pageSource); const pageHeight = pageDimension(document, "PageHeight", pageDimension(pagesDocument, "PageHeight", 11));
  const rawShapes = [...document.getElementsByTagName("Shape")];
  if (rawShapes.length > MAX_SHAPES) throw new Error("A VSDX page can contain up to 20,000 shapes.");
  const result: Element[] = []; const ids = new Map<string, ShapeElement>(); const connectorRecords: { source: globalThis.Element; item: ShapeElement }[] = [];
  for (const raw of rawShapes) {
    const sourceId = raw.getAttribute("ID") ?? ""; const name = raw.getAttribute("NameU") || raw.getAttribute("Name") || "Rectangle";
    const beginX = cellNumber(raw, "BeginX", Number.NaN); const beginY = cellNumber(raw, "BeginY", Number.NaN); const endX = cellNumber(raw, "EndX", Number.NaN); const endY = cellNumber(raw, "EndY", Number.NaN);
    const oneDimensional = raw.getAttribute("OneD") === "1" || directCell(raw, "OneD") === "1" || [beginX, beginY, endX, endY].every(Number.isFinite);
    const color = safeColor(directCell(raw, "LineColor"), "#34495E"); const thickness = Math.max(0.5, Math.min(24, cellNumber(raw, "LineWeight", 0.02) * UNITS_PER_INCH));
    const label = raw.getElementsByTagName("Text")[0]?.textContent?.replace(/\u0000/g, "").slice(0, 10_000) ?? "";
    if (oneDimensional) {
      const x = beginX * UNITS_PER_INCH; const y = (pageHeight - beginY) * UNITS_PER_INCH; const endXpx = endX * UNITS_PER_INCH; const endYpx = (pageHeight - endY) * UNITS_PER_INCH;
      const item: ShapeElement = { type: directCell(raw, "EndArrow") && directCell(raw, "EndArrow") !== "0" ? "arrow" : "line", id: `vsdx-${sourceId || crypto.randomUUID()}`, x, y, w: endXpx - x, h: endYpx - y, color, thickness, lineStyle: directCell(raw, "LinePattern") === "2" ? "dashed" : directCell(raw, "LinePattern") === "3" ? "dotted" : "solid", startHead: directCell(raw, "BeginArrow") && directCell(raw, "BeginArrow") !== "0" ? "open" : "none", endHead: directCell(raw, "EndArrow") && directCell(raw, "EndArrow") !== "0" ? "solid" : "none", ...(label ? { label: { text: label, color: "#111827", fontSize: 14, fontFamily: "sans", verticalAlign: "middle", textAlign: "center", listType: "none" } } : {}) };
      result.push(item); if (sourceId) ids.set(sourceId, item); connectorRecords.push({ source: raw, item }); continue;
    }
    if (name.toLowerCase() === "text") {
      if (label) {
        const pinX = cellNumber(raw, "PinX"); const pinY = cellNumber(raw, "PinY"); const width = Math.max(0.01, cellNumber(raw, "Width", 1.25)); const height = Math.max(0.01, cellNumber(raw, "Height", 0.35));
        const text: TextElement = { type: "text", id: `vsdx-text-${sourceId || crypto.randomUUID()}`, x: (pinX - width / 2) * UNITS_PER_INCH, y: (pageHeight - pinY - height / 2) * UNITS_PER_INCH, text: label.slice(0, 10_000), color: safeColor(sectionCell(raw, "Character", "Color"), "#111827"), fontSize: Math.max(8, Math.min(160, Number.parseFloat(sectionCell(raw, "Character", "Size") ?? "0.1944") * 72)), fontFamily: "sans" };
        result.push(text);
      }
      continue;
    }
    const pinX = cellNumber(raw, "PinX"); const pinY = cellNumber(raw, "PinY"); const width = Math.max(0.01, cellNumber(raw, "Width", 1.25)); const height = Math.max(0.01, cellNumber(raw, "Height", 0.75));
    const x = (pinX - width / 2) * UNITS_PER_INCH; const y = (pageHeight - pinY - height / 2) * UNITS_PER_INCH; const w = width * UNITS_PER_INCH; const h = height * UNITS_PER_INCH;
    const fillPattern = directCell(raw, "FillPattern"); const fillColor = safeColor(directCell(raw, "FillForegnd"), "#FFFFFF");
    const shapeType: ShapeElement["type"] = name.toLowerCase() === "ellipse" || name.toLowerCase() === "circle" ? "circle" : name.toLowerCase() === "diamond" || name.toLowerCase() === "rhombus" ? "diamond" : name.toLowerCase() === "triangle" ? "triangle" : flowchartNames[name] ? "flowchart" : "rectangle";
    const textSize = Math.max(8, Math.min(160, Number.parseFloat(sectionCell(raw, "Character", "Size") ?? "0.1944") * 72)); const rotation = cellNumber(raw, "Angle", 0) * 180 / Math.PI;
    const item: ShapeElement = { type: shapeType, id: `vsdx-${sourceId || crypto.randomUUID()}`, x, y, w, h, color, thickness, ...(fillPattern !== "0" ? { fillColor } : {}), ...(shapeType === "flowchart" ? { flowchartShape: flowchartNames[name] } : {}), ...(rotation ? { rotation } : {}), ...(label ? { label: { text: label, color: safeColor(sectionCell(raw, "Character", "Color"), "#111827"), fontSize: textSize, fontFamily: "sans", verticalAlign: "middle", textAlign: "center", listType: "none" } } : {}) };
    result.push(item); if (sourceId) ids.set(sourceId, item);
  }
  const connects = [...document.getElementsByTagName("Connect")];
  for (const { source, item } of connectorRecords) {
    const id = source.getAttribute("ID"); if (!id) continue;
    const links = connects.filter(connect => connect.getAttribute("FromSheet") === id);
    const endpointTarget = (cellName: string) => {
      const targetId = links.find(connect => connect.getAttribute("FromCell") === cellName)?.getAttribute("ToSheet");
      return targetId ? ids.get(targetId) : undefined;
    };
    const startTarget = endpointTarget("BeginX"); const endTarget = endpointTarget("EndX");
    if (startTarget) item.startBinding = { elementId: startTarget.id!, anchor: elementAnchor(startTarget, { x: item.x + item.w, y: item.y + item.h }) };
    if (endTarget) item.endBinding = { elementId: endTarget.id!, anchor: elementAnchor(endTarget, { x: item.x, y: item.y }) };
  }
  if (!result.length) throw new Error("No supported editable shapes, text, or connectors were found on the first VSDX page.");
  return result;
}
