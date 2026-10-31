import type { Element, Point, ShapeElement } from "../../model";
import { translateElement } from "../canvas/translate";
import { elementBounds, unionBounds } from "../canvas/bounds";
import { resolveBindings } from "../../operations";
import { parseCsv } from "./csv-diagram";

const NODE = { w: 176, h: 64 };
const GAP_X = 28;
const GAP_Y = 60;
const MAX_PEOPLE = 400;
const DEPARTMENT_COLORS = ["#2468a0", "#2f8f6b", "#b9771d", "#8a4fa8", "#b4443c", "#3d7f99", "#7a6a2a", "#5a5f9e"];

export const ORG_CHART_EXAMPLE = "name,title,manager,department\nAda Reyes,CEO,,Leadership\nBen Okafor,VP Engineering,Ada Reyes,Engineering\nChloe Park,VP Product,Ada Reyes,Product\nDev Patel,Staff Engineer,Ben Okafor,Engineering\nEli Moreau,Designer,Chloe Park,Product\nFay Nguyen,Engineer,Ben Okafor,Engineering\n";

const normalize = (header: string) => header.toLowerCase().replace(/[\s_-]+/g, "");
const column = (headers: string[], names: string[]) => headers.findIndex(header => names.includes(normalize(header)));

export type OrgChartResult = { elements: Element[]; warnings: string[] };

/**
 * Builds a top-down org chart from a CSV with name, manager, and optional title, department, and id columns.
 * People without a known manager become roots. Reporting loops are broken with a warning.
 */
export function buildOrgChart(csv: string, center: Point): OrgChartResult {
  const table = parseCsv(csv);
  const nameAt = column(table.headers, ["name", "employee", "person", "fullname", "member"]);
  const idAt = column(table.headers, ["id", "employeeid", "personid"]);
  const managerAt = column(table.headers, ["manager", "reportsto", "supervisor", "boss", "parent", "lead", "managerid"]);
  const titleAt = column(table.headers, ["title", "role", "position", "jobtitle"]);
  const departmentAt = column(table.headers, ["department", "team", "dept", "group"]);
  if (nameAt < 0 && idAt < 0) throw new Error("The CSV needs a name column (or an id column).");
  if (managerAt < 0) throw new Error("The CSV needs a manager column such as manager, reports_to, or supervisor.");
  if (table.rows.length > MAX_PEOPLE) throw new Error(`Org charts are limited to ${MAX_PEOPLE} people.`);
  const warnings: string[] = [];
  type Person = { key: string; name: string; title: string; department: string; managerRef: string; id: string; parent?: Person; children: Person[] };
  const people: Person[] = []; const byKey = new Map<string, Person>(); const usedIds = new Set<string>();
  for (const row of table.rows) {
    const name = (row[nameAt >= 0 ? nameAt : idAt] ?? "").trim(); if (!name) continue;
    const key = (idAt >= 0 && row[idAt] ? row[idAt] : name).trim();
    if (byKey.has(key)) { warnings.push(`Skipped a repeated person: ${key}.`); continue; }
    let id = `org-node:${name}`; let count = 2; while (usedIds.has(id)) id = `org-node:${name} ${count++}`; usedIds.add(id);
    const person: Person = { key, name, title: titleAt >= 0 ? row[titleAt] ?? "" : "", department: departmentAt >= 0 ? row[departmentAt] ?? "" : "", managerRef: (row[managerAt] ?? "").trim(), id, children: [] };
    people.push(person); byKey.set(key, person);
  }
  const byName = new Map(people.map(person => [person.name.toLowerCase(), person]));
  for (const person of people) {
    if (!person.managerRef) continue;
    const manager = byKey.get(person.managerRef) ?? byName.get(person.managerRef.toLowerCase());
    if (!manager) { warnings.push(`${person.name} reports to "${person.managerRef}", who is not in the list, so ${person.name} is shown as a top-level role.`); continue; }
    if (manager === person) { warnings.push(`${person.name} cannot report to themselves.`); continue; }
    let loop = false; for (let ancestor: Person | undefined = manager; ancestor; ancestor = ancestor.parent) if (ancestor === person) { loop = true; break; }
    if (loop) { warnings.push(`Reporting loop at ${person.name}; the link to ${manager.name} was ignored.`); continue; }
    person.parent = manager; manager.children.push(person);
  }
  const roots = people.filter(person => !person.parent);
  const departments = [...new Set(people.map(person => person.department).filter(Boolean))];
  const widths = new Map<Person, number>();
  const widthOf = (person: Person): number => {
    const own = person.children.reduce((sum, child) => sum + widthOf(child), 0) + GAP_X * Math.max(0, person.children.length - 1);
    const width = Math.max(NODE.w, own); widths.set(person, width); return width;
  };
  const positions = new Map<Person, Point>();
  const place = (person: Person, left: number, depth: number) => {
    const width = widths.get(person)!; const span = person.children.reduce((sum, child) => sum + widths.get(child)!, 0) + GAP_X * Math.max(0, person.children.length - 1);
    let cursor = left + (width - span) / 2;
    for (const child of person.children) { place(child, cursor, depth + 1); cursor += widths.get(child)! + GAP_X; }
    // A manager sits over the midpoint of their first and last report, which keeps uneven branches balanced.
    const centerX = person.children.length ? (positions.get(person.children[0])!.x + positions.get(person.children[person.children.length - 1])!.x + NODE.w) / 2 : left + width / 2;
    positions.set(person, { x: centerX - NODE.w / 2, y: depth * (NODE.h + GAP_Y) });
  };
  let rootLeft = 0;
  for (const root of roots) { widthOf(root); place(root, rootLeft, 0); rootLeft += widths.get(root)! + GAP_X * 2; }
  const nodes: ShapeElement[] = people.map(person => {
    const position = positions.get(person)!; const color = person.department ? DEPARTMENT_COLORS[departments.indexOf(person.department) % DEPARTMENT_COLORS.length] : "#52606d";
    return {
      type: "rectangle", id: person.id, x: position.x, y: position.y, w: NODE.w, h: NODE.h, color, thickness: 2, cornerRadius: 8, fillColor: "#ffffff", fillOpacity: 1, liveKey: person.name,
      label: { text: person.title ? `${person.name}\n${person.title}` : person.name, color: "#1f2933", fontSize: 13, fontFamily: "sans", textAlign: "center", verticalAlign: "middle" },
    };
  });
  const idOf = new Map(people.map(person => [person, person.id]));
  const edges: ShapeElement[] = people.flatMap((person, index) => person.parent ? [{
    type: "arrow", id: `org-edge:${index}`, x: 0, y: 0, w: 1, h: 1, color: "#6b7a8c", thickness: 1.6, arrowRoute: "elbow", startHead: "none", endHead: "none",
    startBinding: { elementId: idOf.get(person.parent)!, anchor: { x: .5, y: 1 } }, endBinding: { elementId: person.id, anchor: { x: .5, y: 0 } },
  } as ShapeElement] : []);
  const bounds = unionBounds(nodes.map(elementBounds));
  const shift = bounds ? { x: center.x - bounds.x - bounds.w / 2, y: center.y - bounds.y - bounds.h / 2 } : { x: 0, y: 0 };
  const moved = [...edges, ...nodes].map(item => translateElement(item, shift.x, shift.y));
  if (!nodes.length) throw new Error("No people were found in the CSV.");
  return { elements: resolveBindings([...moved.slice(edges.length), ...moved.slice(0, edges.length)]), warnings };
}
