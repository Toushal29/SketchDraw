import { buildStructuredDiagram, type StructuredGraphLink, type StructuredGraphNode } from "./structured-data";

const LIMIT_BYTES = 5_000_000;
type RecordValue = Record<string, unknown>;
const objectValue = (value: unknown): RecordValue | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
const stringValue = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
function entries(value: unknown): [string, RecordValue][] { return Object.entries(objectValue(value) ?? {}).flatMap(([key, item]) => { const record = objectValue(item); return record ? [[key, record]] : []; }); }

/** Convert a local dbt manifest into a bounded, editable model lineage graph. */
export function dbtManifestToDiagram(input: string | unknown) {
  let root: RecordValue | undefined;
  if (typeof input === "string") {
    if (input.length > LIMIT_BYTES) throw new Error("dbt manifest JSON is limited to 5 MB.");
    try { root = objectValue(JSON.parse(input)); } catch { throw new Error("dbt manifest is not valid JSON."); }
  } else root = objectValue(input);
  if (!root || !objectValue(root.metadata) || !objectValue(root.nodes)) throw new Error("This JSON file is not a dbt manifest with metadata and nodes.");

  const sourceNodes = [...entries(root.nodes), ...entries(root.sources)];
  const exposureNodes = entries(root.exposures);
  const exposureIds = new Set(exposureNodes.map(([key]) => key));
  const includedTypes = new Set(["model", "seed", "snapshot", "test", "source", "exposure"]);
  const selected = [...sourceNodes.filter(([, item]) => includedTypes.has(stringValue(item.resource_type))), ...exposureNodes];
  if (!selected.length) throw new Error("The dbt manifest has no supported models, sources, tests, seeds, snapshots, or exposures.");
  if (selected.length > 500) throw new Error("dbt manifests are limited to 500 diagram objects. Choose a smaller project manifest.");

  const keyById = new Map<string, string>(); const nodes: StructuredGraphNode[] = [];
  for (const [uniqueId, item] of selected) {
    const id = stringValue(item.unique_id) || uniqueId; if (keyById.has(id)) continue;
    const kind = stringValue(item.resource_type) || (exposureIds.has(uniqueId) ? "exposure" : "resource");
    const name = stringValue(item.name) || id.split(".").pop() || id;
    const config = objectValue(item.config) ?? {}; const sourceName = stringValue(item.source_name); const tableName = stringValue(item.identifier);
    const detail = [stringValue(item.description), sourceName ? `Source: ${sourceName}` : "", tableName && tableName !== name ? `Identifier: ${tableName}` : "", stringValue(item.original_file_path) ? `File: ${stringValue(item.original_file_path)}` : "", stringValue(config.materialized) ? `Materialized: ${stringValue(config.materialized)}` : "", stringValue(item.schema) ? `Schema: ${stringValue(item.schema)}` : ""].filter(Boolean).join("\n");
    const key = `dbt:${id}`; keyById.set(id, key);
    nodes.push({ key, title: name, kind: `dbt ${kind}`, detail, liveKey: id, componentRole: `dbt-node|${encodeURIComponent(id)}` });
  }
  const links: StructuredGraphLink[] = [];
  for (const [uniqueId, item] of selected) {
    const id = stringValue(item.unique_id) || uniqueId; const to = keyById.get(id); if (!to) continue;
    const dependencies = objectValue(item.depends_on); const dependenciesList = Array.isArray(dependencies?.nodes) ? dependencies.nodes : [];
    for (const dependency of dependenciesList) {
      const fromId = stringValue(dependency); const from = keyById.get(fromId); if (!from || from === to) continue;
      links.push({ from, to, label: "feeds", liveKey: `${fromId} -> ${id}`, componentRole: `dbt-edge|${encodeURIComponent(fromId)}|${encodeURIComponent(id)}` });
    }
  }
  return buildStructuredDiagram(nodes, links, "dbt");
}
